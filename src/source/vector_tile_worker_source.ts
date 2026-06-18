import {VectorTile} from '@mapbox/vector-tile';
import {PbfReader} from 'pbf';
import WorkerTile from './worker_tile';
import {getPerformanceMeasurement} from '../util/performance';
import {Evented} from '../util/evented';
import {loadVectorTile, DedupedRequest} from './load_vector_tile';

import type {
    WorkerSource,
    WorkerSourceOptions,
    WorkerSourceTileRequest,
    WorkerSourceVectorTileRequest,
    WorkerSourceVectorTileResult,
    WorkerSourceVectorTileCallback,
    WorkerSourceActor,
} from './worker_source';
import type StyleLayerIndex from '../style/style_layer_index';
import type Scheduler from '../util/scheduler';
import type {TaskMetadata} from '../util/scheduler';
import type {LoadVectorData, LoadVectorDataCallback, LoadVectorTileResult} from './load_vector_tile';
import type {Cancelable} from '../types/cancelable';
import type {TileProvider} from './tile_provider';
import type {ImageId} from '../style-spec/expression/types/image_id';
import type {StyleModelMap} from '../style/style_mode';

/**
 * The {@link WorkerSource} implementation that supports {@link VectorTileSource}.
 * This class is designed to be easily reused to support custom source types
 * for data formats that can be parsed/converted into an in-memory VectorTile
 * representation.
 *
 * @private
 */
class VectorTileWorkerSource extends Evented implements WorkerSource {
    actor: WorkerSourceActor;
    layerIndex: StyleLayerIndex;
    availableImages: ImageId[];
    availableModels: StyleModelMap;
    loadVectorData: LoadVectorData;
    tileProvider?: TileProvider<ArrayBuffer | ImageBitmap>;
    loading: Record<number, WorkerTile>;
    loaded: Record<number, WorkerTile>;
    deduped: DedupedRequest;
    isSpriteLoaded: boolean;
    scheduler?: Scheduler | null;
    brightness?: number | null;
    maxUniformBufferBindings?: number | null;
    maxUniformBlockSizeDwords?: number | null;

    /**
     * @private
     */
    constructor({actor, layerIndex, availableImages, availableModels, isSpriteLoaded, tileProvider, brightness, maxUniformBufferBindings, maxUniformBlockSizeDwords}: WorkerSourceOptions) {
        super();
        this.actor = actor;
        this.layerIndex = layerIndex;
        this.availableImages = availableImages;
        this.availableModels = availableModels;
        this.loadVectorData = loadVectorTile;
        this.tileProvider = tileProvider;
        this.loading = {};
        this.loaded = {};
        this.deduped = new DedupedRequest(actor.scheduler);
        this.isSpriteLoaded = isSpriteLoaded;
        this.scheduler = actor.scheduler;
        this.brightness = brightness;
        this.maxUniformBufferBindings = maxUniformBufferBindings;
        this.maxUniformBlockSizeDwords = maxUniformBlockSizeDwords;
    }

    /**
     * Loads tile data using the provider if available, otherwise falls back to loadVectorData.
     * @private
     */
    loadTileData(params: WorkerSourceVectorTileRequest, callback: LoadVectorDataCallback): Cancelable['cancel'] {
        if (!this.tileProvider) {
            return this.loadVectorData(params, callback);
        }

        const controller = new AbortController();
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.loadTileWithProvider(this.tileProvider, params, controller, callback);
        return () => controller.abort();
    }

    async loadTileWithProvider(provider: TileProvider<ArrayBuffer | ImageBitmap>, params: WorkerSourceVectorTileRequest, controller: AbortController, callback: LoadVectorDataCallback) {
        const {z, x, y} = params.tileID.canonical;
        try {
            const response = await provider.loadTile({z, x, y}, {request: params.request, signal: controller.signal});

            if (controller.signal.aborted) return;

            // Produce a 404 error so SourceCache triggers parent tile lookup for the missing tile
            if (response == null) {
                const err: Error & {status?: number} = new Error('Tile not found');
                err.status = 404;
                return callback(err);
            }

            // Intentionally empty tile
            if (response.data == null) return callback(null, null);

            if (response.data instanceof ImageBitmap) {
                return callback(new Error('Vector tiles require ArrayBuffer data'));
            }

            const headers = new Headers();
            if (response.expires) headers.set('expires', response.expires);
            if (response.cacheControl) headers.set('cache-control', response.cacheControl);

            callback(null, {rawData: response.data, headers});
        } catch (err) {
            if (controller.signal.aborted) return;
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            callback(err instanceof Error ? err : new Error(String(err)));
        }
    }

    /**
     * Implements {@link WorkerSource#loadTile}. Delegates to
     * {@link VectorTileWorkerSource#loadTileData} for fetching raw tile data.
     * @private
     */
    _fetchTileData(workerTile: WorkerTile, params: WorkerSourceVectorTileRequest): Promise<LoadVectorTileResult | null | undefined> {
        return new Promise((resolve, reject) => {
            workerTile.abort = this.loadTileData(params, (err, response) => {
                if (err) reject(err);
                else resolve(response);
            });
        });
    }

    async _parse(workerTile: WorkerTile, params: WorkerSourceVectorTileRequest): Promise<WorkerSourceVectorTileResult | null | undefined> {
        // When the sprite isn't ready, defer until Style emits 'spriteLoaded' (surfaced here as 'isSpriteLoaded').
        const deferred = !this.isSpriteLoaded;
        if (deferred) {
            await this.once('isSpriteLoaded');
        }

        return new Promise<WorkerSourceVectorTileResult | null | undefined>((resolve, reject) => {
            const runParse = () => workerTile.parse(workerTile.vectorTile, this.layerIndex, this.availableImages, this.availableModels, this.actor, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });

            // Tiles that waited for the sprite are routed through the scheduler so parsing is prioritized by zoom/type.
            if (deferred && this.scheduler) {
                const metadata: TaskMetadata = {type: 'parseTile', renderSourceType: params.renderSourceType, zoom: params.tileZoom};
                this.scheduler.add(runParse, metadata);
            } else {
                runParse();
            }
        });
    }

    async loadTile(params: WorkerSourceVectorTileRequest): Promise<WorkerSourceVectorTileResult | null> {
        const uid = params.uid;
        const requestParam = params && params.request;
        const perf = requestParam && requestParam.collectResourceTiming;

        const workerTile = this.loading[uid] = new WorkerTile(params);
        workerTile.maxUniformBufferBindings = this.maxUniformBufferBindings;
        workerTile.maxUniformBlockSizeDwords = this.maxUniformBlockSizeDwords;

        const reload = (err: Error | null, result?: WorkerSourceVectorTileResult | null) => {
            const reloadCallback = workerTile.reloadCallback;
            if (!reloadCallback) return;
            delete workerTile.reloadCallback;
            if (err || !result) {
                reloadCallback(err, null);
            } else {
                workerTile.parse(workerTile.vectorTile, this.layerIndex, this.availableImages, this.availableModels, this.actor, reloadCallback);
            }
        };

        let response: LoadVectorTileResult | null | undefined;
        let dataErr: unknown;
        try {
            response = await this._fetchTileData(workerTile, params);
        } catch (err) {
            dataErr = err;
        }

        const aborted = !this.loading[uid];
        delete this.loading[uid];
        workerTile.cancelRasterize();

        if (dataErr || aborted || !response) {
            workerTile.status = 'done';
            if (!aborted) this.loaded[uid] = workerTile;
            if (dataErr) throw dataErr;
            return null;
        }

        const rawTileData = response.rawData;

        // response.vectorTile will be present in the GeoJSON worker case (which inherits from this class)
        // because we stub the vector tile interface around JSON data instead of parsing it directly
        workerTile.vectorTile = response.vectorTile || new VectorTile(new PbfReader(rawTileData));

        this.loaded = this.loaded || {};
        this.loaded[uid] = workerTile;

        let result: WorkerSourceVectorTileResult | null | undefined;
        try {
            result = await this._parse(workerTile, params);
        } catch (err) {
            reload(err as Error);
            throw err;
        }

        if (!result) {
            reload(null, null);
            return null;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resourceTiming: Record<string, any> = {};
        if (perf) {
            // Transferring a copy of rawTileData because the worker needs to retain its copy.
            const resourceTimingData = getPerformanceMeasurement(requestParam);
            // it's necessary to eval the result of getEntriesByName() here via parse/stringify
            // late evaluation in the main thread causes TypeError: illegal invocation
            if (resourceTimingData.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                resourceTiming.resourceTiming = JSON.parse(JSON.stringify(resourceTimingData));
            }
        }

        const finalResult = {rawTileData: rawTileData.slice(0), headers: response.headers, ...result, ...resourceTiming} as WorkerSourceVectorTileResult;

        reload(null, result);

        return finalResult;
    }

    /**
     * Implements {@link WorkerSource#reloadTile}.
     * @private
     */
    async reloadTile(params: WorkerSourceVectorTileRequest): Promise<WorkerSourceVectorTileResult | undefined | null> {
        const loaded = this.loaded;
        const uid = params.uid;

        if (loaded && loaded[uid]) {
            return new Promise((resolve, reject) => {
                const workerTile = loaded[uid];
                workerTile.updateParameters(params);
                const done: WorkerSourceVectorTileCallback = (err, data) => {
                    const reloadCallback = workerTile.reloadCallback;
                    if (reloadCallback) {
                        delete workerTile.reloadCallback;
                        workerTile.parse(workerTile.vectorTile, this.layerIndex, this.availableImages, this.availableModels, this.actor, reloadCallback);
                    }
                    if (err) reject(err);
                    else resolve(data);
                };

                if (workerTile.status === 'parsing') {
                    workerTile.reloadCallback = done;
                } else if (workerTile.status === 'done') {
                    // if there was no vector tile data on the initial load, don't try and re-parse tile
                    if (workerTile.vectorTile) {
                        workerTile.parse(workerTile.vectorTile, this.layerIndex, this.availableImages, this.availableModels, this.actor, done);
                    } else {
                        done();
                    }
                } else {
                    resolve(undefined);
                }
            });
        }
    }

    /**
     * Implements {@link WorkerSource#abortTile}.
     * @private
     */
    abortTile(params: WorkerSourceTileRequest): void {
        const uid = params.uid;
        const tile = this.loading[uid];
        if (tile) {
            if (tile.abort) tile.abort();
            delete this.loading[uid];
        }
    }

    /**
     * Implements {@link WorkerSource#removeTile}.
     * @private
     */
    removeTile(params: WorkerSourceTileRequest): void {
        const loaded = this.loaded,
            uid = params.uid;
        if (loaded && loaded[uid]) {
            delete loaded[uid];
        }
    }
}

export default VectorTileWorkerSource;
