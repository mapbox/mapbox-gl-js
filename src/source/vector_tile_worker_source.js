// @flow

import {getArrayBuffer} from '../util/ajax.js';

import vt from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import WorkerTile from './worker_tile.js';
import {extend} from '../util/util.js';
import {getPerformanceMeasurement} from '../util/performance.js';
import {Evented} from '../util/evented.js';
import tileTransform from '../geo/projection/tile_transform.js';

import type {
    WorkerSource,
    WorkerTileParameters,
    RequestedTileParameters,
    WorkerTileCallback,
    TileParameters
} from '../source/worker_source.js';

import type Actor from '../util/actor.js';
import type StyleLayerIndex from '../style/style_layer_index.js';
import type {Callback} from '../types/callback.js';
import type Scheduler from '../util/scheduler.js';

export type LoadVectorTileResult = {
    rawData: ArrayBuffer;
    vectorTile?: VectorTile;
    expires?: any;
    cacheControl?: any;
    resourceTiming?: Array<PerformanceResourceTiming>;
};

/**
 * @callback LoadVectorDataCallback
 * @param error
 * @param vectorTile
 * @private
 */
export type LoadVectorDataCallback = Callback<?LoadVectorTileResult>;

export type AbortVectorData = () => void;
export type LoadVectorData = (params: RequestedTileParameters, callback: LoadVectorDataCallback) => ?AbortVectorData;
export class DedupedRequest {
    entries: { [string]: Object };
    scheduler: ?Scheduler;

    constructor(scheduler?: Scheduler) {
        this.entries = {};
        this.scheduler = scheduler;
    }

    request(key: string, metadata: Object, request: any, callback: LoadVectorDataCallback): (() => void) {
        const entry = this.entries[key] = this.entries[key] || {callbacks: []};

        if (entry.result) {
            const [err, result] = entry.result;
            if (this.scheduler) {
                this.scheduler.add(() => {
                    callback(err, result);
                }, metadata);
            } else {
                callback(err, result);
            }
            return () => {};
        }

        entry.callbacks.push(callback);

        if (!entry.cancel) {
            entry.cancel = request((err, result) => {
                entry.result = [err, result];
                for (const cb of entry.callbacks) {
                    if (this.scheduler) {
                        this.scheduler.add(() => {
                            cb(err, result);
                        }, metadata);
                    } else {
                        cb(err, result);
                    }
                }
                setTimeout(() => delete this.entries[key], 1000 * 3);
            });
        }

        return () => {
            if (entry.result) return;
            entry.callbacks = entry.callbacks.filter(cb => cb !== callback);
            if (!entry.callbacks.length) {
                entry.cancel();
                delete this.entries[key];
            }
        };
    }
}

/**
 * @private
 */
export function loadVectorTile(params: RequestedTileParameters, callback: LoadVectorDataCallback, skipParse?: boolean): (() => void) {
    const key = JSON.stringify(params.request);

    const makeRequest = (callback) => {
        const request = getArrayBuffer(params.request, (err: ?Error, data: ?ArrayBuffer, cacheControl: ?string, expires: ?string) => {
            if (err) {
                callback(err);
            } else if (data) {
                callback(null, {
                    vectorTile: skipParse ? undefined : new vt.VectorTile(new Protobuf(data)),
                    rawData: data,
                    cacheControl,
                    expires
                });
            }
        });
        return () => {
            request.cancel();
            callback();
        };
    };

    if (params.data) {
        // if we already got the result earlier (on the main thread), return it directly
        (this.deduped: DedupedRequest).entries[key] = {result: [null, params.data]};
    }

    const callbackMetadata = {type: 'parseTile', isSymbolTile: params.isSymbolTile, zoom: params.tileZoom};
    return (this.deduped: DedupedRequest).request(key, callbackMetadata, makeRequest, callback);
}

/**
 * The {@link WorkerSource} implementation that supports {@link VectorTileSource}.
 * This class is designed to be easily reused to support custom source types
 * for data formats that can be parsed/converted into an in-memory VectorTile
 * representation.  To do so, create it with
 * `new VectorTileWorkerSource(actor, styleLayers, customLoadVectorDataFunction)`.
 *
 * @private
 */
class VectorTileWorkerSource extends Evented implements WorkerSource {
    actor: Actor;
    layerIndex: StyleLayerIndex;
    availableImages: Array<string>;
    loadVectorData: LoadVectorData;
    loading: {[_: number]: WorkerTile };
    loaded: {[_: number]: WorkerTile };
    deduped: DedupedRequest;
    isSpriteLoaded: boolean;
    scheduler: ?Scheduler;

    /**
     * @param [loadVectorData] Optional method for custom loading of a VectorTile
     * object based on parameters passed from the main-thread Source. See
     * {@link VectorTileWorkerSource#loadTile}. The default implementation simply
     * loads the pbf at `params.url`.
     * @private
     */
    constructor(actor: Actor, layerIndex: StyleLayerIndex, availableImages: Array<string>, isSpriteLoaded: boolean, loadVectorData: ?LoadVectorData) {
        super();
        this.actor = actor;
        this.layerIndex = layerIndex;
        this.availableImages = availableImages;
        this.loadVectorData = loadVectorData || loadVectorTile;
        this.loading = {};
        this.loaded = {};
        this.deduped = new DedupedRequest(actor.scheduler);
        this.isSpriteLoaded = isSpriteLoaded;
        this.scheduler = actor.scheduler;
    }

    /**
     * Implements {@link WorkerSource#loadTile}. Delegates to
     * {@link VectorTileWorkerSource#loadVectorData} (which by default expects
     * a `params.url` property) for fetching and producing a VectorTile object.
     * @private
     */
    loadTile(params: WorkerTileParameters, callback: WorkerTileCallback) {
        const uid = params.uid;

        const requestParam = params && params.request;
        const perf = requestParam && requestParam.collectResourceTiming;

        const workerTile = this.loading[uid] = new WorkerTile(params);
        workerTile.abort = this.loadVectorData(params, (err, response) => {

            const aborted = !this.loading[uid];

            delete this.loading[uid];

            if (aborted || err || !response) {
                workerTile.status = 'done';
                if (!aborted) this.loaded[uid] = workerTile;
                return callback(err);
            }

            const rawTileData = response.rawData;
            const cacheControl = {};
            if (response.expires) cacheControl.expires = response.expires;
            if (response.cacheControl) cacheControl.cacheControl = response.cacheControl;

            // response.vectorTile will be present in the GeoJSON worker case (which inherits from this class)
            // because we stub the vector tile interface around JSON data instead of parsing it directly
            workerTile.vectorTile = response.vectorTile || new vt.VectorTile(new Protobuf(rawTileData));
            const parseTile = () => {
                workerTile.parse(workerTile.vectorTile, this.layerIndex, this.availableImages, this.actor, (err, result) => {
                    if (err || !result) return callback(err);

                    const resourceTiming = {};
                    if (perf) {
                        // Transferring a copy of rawTileData because the worker needs to retain its copy.
                        const resourceTimingData = getPerformanceMeasurement(requestParam);
                        // it's necessary to eval the result of getEntriesByName() here via parse/stringify
                        // late evaluation in the main thread causes TypeError: illegal invocation
                        if (resourceTimingData.length > 0) {
                            resourceTiming.resourceTiming = JSON.parse(JSON.stringify(resourceTimingData));
                        }
                    }
                    callback(null, extend({rawTileData: rawTileData.slice(0)}, result, cacheControl, resourceTiming));
                });
            };

            if (this.isSpriteLoaded) {
                parseTile();
            } else {
                this.once('isSpriteLoaded', () => {
                    if (this.scheduler) {
                        const metadata = {type: 'parseTile', isSymbolTile: params.isSymbolTile, zoom: params.tileZoom};
                        this.scheduler.add(parseTile, metadata);
                    } else {
                        parseTile();
                    }
                });
            }

            this.loaded = this.loaded || {};
            this.loaded[uid] = workerTile;
        });
    }

    /**
     * Implements {@link WorkerSource#reloadTile}.
     * @private
     */
    reloadTile(params: WorkerTileParameters, callback: WorkerTileCallback) {
        const loaded = this.loaded,
            uid = params.uid,
            vtSource = this;
        if (loaded && loaded[uid]) {
            const workerTile = loaded[uid];
            workerTile.showCollisionBoxes = params.showCollisionBoxes;
            workerTile.enableTerrain = !!params.enableTerrain;
            workerTile.projection = params.projection;
            workerTile.tileTransform = tileTransform(params.tileID.canonical, params.projection);

            const done = (err, data) => {
                const reloadCallback = workerTile.reloadCallback;
                if (reloadCallback) {
                    delete workerTile.reloadCallback;
                    workerTile.parse(workerTile.vectorTile, vtSource.layerIndex, this.availableImages, vtSource.actor, reloadCallback);
                }
                callback(err, data);
            };

            if (workerTile.status === 'parsing') {
                workerTile.reloadCallback = done;
            } else if (workerTile.status === 'done') {
                // if there was no vector tile data on the initial load, don't try and re-parse tile
                if (workerTile.vectorTile) {
                    workerTile.parse(workerTile.vectorTile, this.layerIndex, this.availableImages, this.actor, done);
                } else {
                    done();
                }
            }
        }
    }

    /**
     * Implements {@link WorkerSource#abortTile}.
     *
     * @param params
     * @param params.uid The UID for this tile.
     * @private
     */
    abortTile(params: TileParameters, callback: WorkerTileCallback) {
        const uid = params.uid;
        const tile = this.loading[uid];
        if (tile) {
            if (tile.abort) tile.abort();
            delete this.loading[uid];
        }
        callback();
    }

    /**
     * Implements {@link WorkerSource#removeTile}.
     *
     * @param params
     * @param params.uid The UID for this tile.
     * @private
     */
    removeTile(params: TileParameters, callback: WorkerTileCallback) {
        const loaded = this.loaded,
            uid = params.uid;
        if (loaded && loaded[uid]) {
            delete loaded[uid];
        }
        callback();
    }
}

export default VectorTileWorkerSource;
