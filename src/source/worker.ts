import Actor from '../util/actor';
import StyleLayerIndex from '../style/style_layer_index';
import VectorTileWorkerSource from './vector_tile_worker_source';
import RasterDEMTileWorkerSource from './raster_dem_tile_worker_source';
import RasterArrayTileWorkerSource from './raster_array_tile_worker_source';
import GeoJSONWorkerSource from './geojson_worker_source';
import Tiled3dModelWorkerSource from '../../3d-style/source/tiled_3d_model_worker_source';
import assert from 'assert';
import {plugin as globalRTLTextPlugin} from './rtl_text_plugin';
import {enforceCacheSizeLimit} from '../util/tile_request_cache';
import {PerformanceUtils} from '../util/performance';
import {Event} from '../util/evented';
import {getProjection} from '../geo/projection/index';
import {ImageRasterizer} from '../render/image_rasterizer';

import type {
    WorkerSource,
    WorkerSourceTileRequest,
    WorkerSourceRasterArrayDecodingParameters,
    WorkerSourceRasterArrayDecodingCallback,
    WorkerSourceConstructor,
    WorkerSourceImageRaserizeParameters,
    WorkerSourceRemoveRasterizedImagesParameters,
    WorkerSourceImageRaserizeCallback
} from './worker_source';
import type {Callback} from '../types/callback';
import type {LayerSpecification, ProjectionSpecification} from '../style-spec/types';
import type {ConfigOptions} from '../style/properties';
import type {RtlTextPlugin, PluginState} from './rtl_text_plugin';
import type Projection from '../geo/projection/projection';
import type {RasterizedImageMap} from '../render/image_manager';
import type {SetImagesParameters} from '../style/style';
import type {WorkerPerformanceMetrics} from '../util/performance';
import type {ImageId} from '../style-spec/expression/types/image_id';

/**
 * Source types that can instantiate a {@link WorkerSource} in {@link MapWorker}.
 */
type WorkerSourceType =
    | 'vector'
    | 'geojson'
    | 'raster-dem'
    | 'raster-array'
    | 'batched-model';

/**
 * Generic type for grouping items by mapId and style scope.
 */
type WorkerScopeRegistry<T> = Record<string, Record<string, T>>;

/**
 * WorkerSources grouped by mapId, style scope, sourceType, and sourceId.
 */
type WorkerSourceRegistry = WorkerScopeRegistry<Record<string, Record<string, WorkerSource>>>;

/**
 * @private
 */
export default class MapWorker {
    self: Worker;
    actor: Actor;
    layerIndexes: WorkerScopeRegistry<StyleLayerIndex>;
    availableImages: WorkerScopeRegistry<ImageId[]>;
    workerSourceTypes: Record<WorkerSourceType, WorkerSourceConstructor>;
    workerSources: WorkerSourceRegistry;
    projections: Record<string, Projection>;
    defaultProjection: Projection;
    isSpriteLoaded: WorkerScopeRegistry<boolean>;
    referrer: string | null | undefined;
    dracoUrl: string | null | undefined;
    brightness: number | null | undefined;
    imageRasterizer: ImageRasterizer;

    constructor(self: Worker) {
        PerformanceUtils.measure('workerEvaluateScript');
        this.self = self;
        this.actor = new Actor(self, this as unknown as Worker);

        this.layerIndexes = {};
        this.availableImages = {};
        this.isSpriteLoaded = {};
        this.imageRasterizer = new ImageRasterizer();

        this.projections = {};
        this.defaultProjection = getProjection({name: 'mercator'});

        this.workerSourceTypes = {
            'vector': VectorTileWorkerSource,
            'geojson': GeoJSONWorkerSource,
            'raster-dem': RasterDEMTileWorkerSource,
            'raster-array': RasterArrayTileWorkerSource,
            'batched-model': Tiled3dModelWorkerSource
        };

        // [mapId][scope][sourceType][sourceName] => worker source instance
        this.workerSources = {};

        this.self.registerWorkerSource = (name: string, WorkerSource: WorkerSourceConstructor) => {
            if (this.workerSourceTypes[name]) {
                throw new Error(`Worker source with name "${name}" already registered.`);
            }
            this.workerSourceTypes[name] = WorkerSource;
        };

        // This is invoked by the RTL text plugin when the download via the `importScripts` call has finished, and the code has been parsed.
        this.self.registerRTLTextPlugin = (rtlTextPlugin: RtlTextPlugin) => {
            if (globalRTLTextPlugin.isParsed()) {
                throw new Error('RTL text plugin already registered.');
            }
            globalRTLTextPlugin['applyArabicShaping'] = rtlTextPlugin.applyArabicShaping;
            globalRTLTextPlugin['processBidirectionalText'] = rtlTextPlugin.processBidirectionalText;
            globalRTLTextPlugin['processStyledBidirectionalText'] = rtlTextPlugin.processStyledBidirectionalText;
        };
    }

    clearCaches(mapId: string, unused: unknown, callback: Callback<void>) {
        delete this.layerIndexes[mapId];
        delete this.availableImages[mapId];
        delete this.workerSources[mapId];
        callback();
    }

    checkIfReady(mapID: string, unused: unknown, callback: Callback<void>) {
        // noop, used to check if a worker is fully set up and ready to receive messages
        callback();
    }

    setReferrer(mapID: string, referrer: string) {
        this.referrer = referrer;
    }

    spriteLoaded(mapId: string, {scope, isLoaded}: {scope: string; isLoaded: boolean}) {
        if (!this.isSpriteLoaded[mapId])
            this.isSpriteLoaded[mapId] = {};

        this.isSpriteLoaded[mapId][scope] = isLoaded;

        if (!this.workerSources[mapId] || !this.workerSources[mapId][scope]) {
            return;
        }

        for (const workerSource in this.workerSources[mapId][scope]) {
            const ws = this.workerSources[mapId][scope][workerSource];
            for (const source in ws) {
                const workerSource = ws[source];
                if (workerSource instanceof VectorTileWorkerSource) {
                    workerSource.isSpriteLoaded = isLoaded;
                    workerSource.fire(new Event('isSpriteLoaded'));
                }
            }
        }
    }

    setImages(mapId: string, {scope, images}: SetImagesParameters, callback: Callback<void>) {
        if (!this.availableImages[mapId]) {
            this.availableImages[mapId] = {};
        }

        this.availableImages[mapId][scope] = images;

        if (!this.workerSources[mapId] || !this.workerSources[mapId][scope]) {
            callback();
            return;
        }

        for (const workerSource in this.workerSources[mapId][scope]) {
            const ws = this.workerSources[mapId][scope][workerSource];
            for (const source in ws) {
                ws[source].availableImages = images;
            }
        }

        callback();
    }

    setProjection(mapId: string, config: ProjectionSpecification) {
        this.projections[mapId] = getProjection(config);
    }

    setBrightness(mapId: string, brightness: number | null | undefined, callback: Callback<void>) {
        this.brightness = brightness;
        callback();
    }

    setLayers(mapId: string, params: {
        layers: Array<LayerSpecification>;
        scope: string;
        options: ConfigOptions;
    }, callback: Callback<void>) {
        this.getLayerIndex(mapId, params.scope).replace(params.layers, params.options);
        callback();
    }

    updateLayers(mapId: string, params: {
        layers: Array<LayerSpecification>;
        scope: string;
        removedIds: Array<string>;
        options: ConfigOptions;
    }, callback: Callback<void>) {
        this.getLayerIndex(mapId, params.scope).update(params.layers, params.removedIds, params.options);
        callback();
    }

    loadTile(mapId: string, params: WorkerSourceTileRequest, callback: Callback<unknown>) {
        assert(params.type);
        params.projection = this.projections[mapId] || this.defaultProjection;
        this.getWorkerSource(mapId, params.type, params.source, params.scope).loadTile(params, callback);
    }

    decodeRasterArray(mapId: string, params: WorkerSourceRasterArrayDecodingParameters, callback: WorkerSourceRasterArrayDecodingCallback) {
        (this.getWorkerSource(mapId, params.type, params.source, params.scope) as RasterArrayTileWorkerSource).decodeRasterArray(params, callback);
    }

    reloadTile(mapId: string, params: WorkerSourceTileRequest, callback: Callback<unknown>) {
        assert(params.type);
        params.projection = this.projections[mapId] || this.defaultProjection;
        this.getWorkerSource(mapId, params.type, params.source, params.scope).reloadTile(params, callback);
    }

    abortTile(mapId: string, params: WorkerSourceTileRequest, callback: Callback<unknown>) {
        assert(params.type);
        this.getWorkerSource(mapId, params.type, params.source, params.scope).abortTile(params, callback);
    }

    removeTile(mapId: string, params: WorkerSourceTileRequest, callback: Callback<unknown>) {
        assert(params.type);
        this.getWorkerSource(mapId, params.type, params.source, params.scope).removeTile(params, callback);
    }

    removeSource(mapId: string, params: WorkerSourceTileRequest, callback: Callback<void>) {
        assert(params.type);
        assert(params.scope);
        assert(params.source);

        if (!this.workerSources[mapId] ||
            !this.workerSources[mapId][params.scope] ||
            !this.workerSources[mapId][params.scope][params.type] ||
            !this.workerSources[mapId][params.scope][params.type][params.source]) {
            return;
        }

        const worker = this.workerSources[mapId][params.scope][params.type][params.source];
        delete this.workerSources[mapId][params.scope][params.type][params.source];

        if (worker.removeSource !== undefined) {
            worker.removeSource(params, callback);
        } else {
            callback();
        }
    }

    /**
     * Load a {@link WorkerSource} script at params.url.  The script is run
     * (using importScripts) with `registerWorkerSource` in scope, which is a
     * function taking `(name, workerSourceObject)`.
     *  @private
     */
    loadWorkerSource(map: string, params: {url: string}, callback: Callback<undefined>) {
        try {
            this.self.importScripts(params.url);
            callback();
        } catch (e) {
            callback(e.toString());
        }
    }

    syncRTLPluginState(map: string, state: PluginState, callback: Callback<boolean>) {
        try {
            globalRTLTextPlugin.setState(state);
            const pluginURL = globalRTLTextPlugin.getPluginURL();
            if (
                globalRTLTextPlugin.isLoaded() &&
                !globalRTLTextPlugin.isParsed() &&
                pluginURL != null // Not possible when `isLoaded` is true, but keeps flow happy
            ) {
                this.self.importScripts(pluginURL);
                const complete = globalRTLTextPlugin.isParsed();
                const error = complete ? undefined : new Error(`RTL Text Plugin failed to import scripts from ${pluginURL}`);
                callback(error, complete);
            }
        } catch (e: any) {
            callback(e.toString());
        }
    }

    setDracoUrl(map: string, dracoUrl: string) {
        this.dracoUrl = dracoUrl;
    }

    getAvailableImages(mapId: string, scope: string): ImageId[] {
        if (!this.availableImages[mapId]) {
            this.availableImages[mapId] = {};
        }

        let availableImages = this.availableImages[mapId][scope];

        if (!availableImages) {
            availableImages = [];
        }

        return availableImages;
    }

    getLayerIndex(mapId: string, scope: string): StyleLayerIndex {
        if (!this.layerIndexes[mapId]) {
            this.layerIndexes[mapId] = {};
        }

        let layerIndex = this.layerIndexes[mapId][scope];

        if (!layerIndex) {
            layerIndex = this.layerIndexes[mapId][scope] = new StyleLayerIndex();
            layerIndex.scope = scope;
        }

        return layerIndex;
    }

    getWorkerSource(mapId: string, type: string, source: string, scope: string): WorkerSource {
        const workerSources = this.workerSources;

        if (!workerSources[mapId])
            workerSources[mapId] = {};
        if (!workerSources[mapId][scope])
            workerSources[mapId][scope] = {} as Record<WorkerSourceType, {[sourceId: string]: WorkerSource}>;
        if (!workerSources[mapId][scope][type])
            workerSources[mapId][scope][type] = {};

        if (!this.isSpriteLoaded[mapId])
            this.isSpriteLoaded[mapId] = {};

        if (!workerSources[mapId][scope][type][source]) {
            // use a wrapped actor so that we can attach a target mapId param
            // to any messages invoked by the WorkerSource
            const actor = {
                send: (type: string, data: unknown, callback: any, _: any, mustQueue: boolean, metadata: any) => {
                    this.actor.send(type, data, callback, mapId, mustQueue, metadata);
                },
                scheduler: this.actor.scheduler
            } as Actor;

            workerSources[mapId][scope][type][source] = new this.workerSourceTypes[type](
                actor,
                this.getLayerIndex(mapId, scope),
                this.getAvailableImages(mapId, scope),
                this.isSpriteLoaded[mapId][scope],
                undefined,
                this.brightness
            );
        }

        return workerSources[mapId][scope][type][source];
    }

    rasterizeImages(mapId: string, params: WorkerSourceImageRaserizeParameters, callback: WorkerSourceImageRaserizeCallback) {
        const rasterizedImages: RasterizedImageMap = new Map();
        for (const [id, {image, imageVariant}] of params.tasks.entries()) {
            const rasterizedImage = this.imageRasterizer.rasterize(imageVariant, image, params.scope, mapId);
            rasterizedImages.set(id, rasterizedImage);
        }
        callback(undefined, rasterizedImages);
    }

    removeRasterizedImages(mapId: string, params: WorkerSourceRemoveRasterizedImagesParameters, callback: Callback<void>) {
        this.imageRasterizer.removeImagesFromCacheByIds(params.imageIds, params.scope, mapId);
        callback();
    }

    enforceCacheSizeLimit(mapId: string, limit: number) {
        enforceCacheSizeLimit(limit);
    }

    getWorkerPerformanceMetrics(mapId: string, params: any, callback: Callback<WorkerPerformanceMetrics>) {
        callback(undefined, PerformanceUtils.getWorkerPerformanceMetrics());
    }
}

// @ts-expect-error - TS2304
if (typeof WorkerGlobalScope !== 'undefined' &&
    typeof self !== 'undefined' &&
    // @ts-expect-error - TS2304
    self instanceof WorkerGlobalScope) {
    // @ts-expect-error - TS2551 - Property 'worker' does not exist on type 'Window & typeof globalThis'. Did you mean 'Worker'? | TS2345 - Argument of type 'Window & typeof globalThis' is not assignable to parameter of type 'WorkerGlobalScopeInterface'.
    self.worker = new MapWorker(self);
}
