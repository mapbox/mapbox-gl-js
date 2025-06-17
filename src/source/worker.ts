import Actor from '../util/actor';
import StyleLayerIndex from '../style/style_layer_index';
import VectorTileWorkerSource from './vector_tile_worker_source';
import RasterDEMTileWorkerSource from './raster_dem_tile_worker_source';
import RasterArrayTileWorkerSource from './raster_array_tile_worker_source';
import GeoJSONWorkerSource from './geojson_worker_source';
import Tiled3dModelWorkerSource from '../../3d-style/source/tiled_3d_model_worker_source';
import assert from 'assert';
import {plugin as globalRTLTextPlugin, rtlPluginStatus} from './rtl_text_plugin';
import {enforceCacheSizeLimit} from '../util/tile_request_cache';
import {PerformanceUtils} from '../util/performance';
import {Event} from '../util/evented';
import {getProjection} from '../geo/projection/index';
import {ImageRasterizer} from '../render/image_rasterizer';
import {isWorker} from '../util/util';

import type Projection from '../geo/projection/projection';
import type {ImageId} from '../style-spec/expression/types/image_id';
import type {TaskMetadata} from '../util/scheduler';
import type {RtlTextPlugin} from './rtl_text_plugin';
import type {RasterizedImageMap} from '../render/image_manager';
import type {ActorMessage, ActorMessages} from '../util/actor_messages';
import type {WorkerSource, WorkerSourceConstructor} from './worker_source';
import type {StyleModelMap} from '../style/style_mode';
import type {Callback} from '../types/callback';

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
    availableModels: WorkerScopeRegistry<StyleModelMap>;
    workerSourceTypes: Record<WorkerSourceType, WorkerSourceConstructor>;
    workerSources: WorkerSourceRegistry;
    projections: Record<string, Projection>;
    defaultProjection: Projection;
    isSpriteLoaded: WorkerScopeRegistry<boolean>;
    referrer: string | null | undefined;
    dracoUrl: string | null | undefined;
    brightness: number | null | undefined;
    imageRasterizer: ImageRasterizer;
    worldview: string | undefined;
    rtlPluginParsingListeners: Array<Callback<boolean>>;

    constructor(self: Worker) {
        PerformanceUtils.measure('workerEvaluateScript');
        this.self = self;
        this.actor = new Actor(self, this);

        this.layerIndexes = {};
        this.availableImages = {};
        this.availableModels = {};
        this.isSpriteLoaded = {};
        this.imageRasterizer = new ImageRasterizer();
        this.rtlPluginParsingListeners = [];

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

            globalRTLTextPlugin.setState({
                pluginStatus: rtlPluginStatus.parsed,
                pluginURL: globalRTLTextPlugin.getPluginURL()
            });
            globalRTLTextPlugin['applyArabicShaping'] = rtlTextPlugin.applyArabicShaping;
            globalRTLTextPlugin['processBidirectionalText'] = rtlTextPlugin.processBidirectionalText;
            globalRTLTextPlugin['processStyledBidirectionalText'] = rtlTextPlugin.processStyledBidirectionalText;

            for (const callback of this.rtlPluginParsingListeners) {
                callback(null, true);
            }
            this.rtlPluginParsingListeners = [];
        };
    }

    clearCaches(mapId: number, params: ActorMessages['clearCaches']['params'], callback: ActorMessages['clearCaches']['callback']) {
        delete this.layerIndexes[mapId];
        delete this.availableImages[mapId];
        delete this.availableModels[mapId];
        delete this.workerSources[mapId];
        callback();
    }

    checkIfReady(mapID: string, params: ActorMessages['checkIfReady']['params'], callback: ActorMessages['checkIfReady']['callback']) {
        // noop, used to check if a worker is fully set up and ready to receive messages
        callback();
    }

    setReferrer(mapID: string, referrer: ActorMessages['setReferrer']['params']) {
        this.referrer = referrer;
    }

    spriteLoaded(mapId: number, params: ActorMessages['spriteLoaded']['params']) {
        if (!this.isSpriteLoaded[mapId])
            this.isSpriteLoaded[mapId] = {};

        const {scope, isLoaded} = params;
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

    setImages(mapId: number, params: ActorMessages['setImages']['params'], callback: ActorMessages['setImages']['callback']) {
        if (!this.availableImages[mapId]) {
            this.availableImages[mapId] = {};
        }

        const {scope, images} = params;
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

    setModels(mapId: number, {scope, models}: ActorMessages['setModels']['params'], callback: ActorMessages['setModels']['callback']) {
        if (!this.availableModels[mapId]) {
            this.availableModels[mapId] = {};
        }

        this.availableModels[mapId][scope] = models;

        if (!this.workerSources[mapId] || !this.workerSources[mapId][scope]) {
            callback();
            return;
        }

        for (const workerSource in this.workerSources[mapId][scope]) {
            const ws = this.workerSources[mapId][scope][workerSource];
            for (const source in ws) {
                ws[source].availableModels = models;
            }
        }

        callback();
    }

    setProjection(mapId: number, config: ActorMessages['setProjection']['params']) {
        this.projections[mapId] = getProjection(config);
    }

    setBrightness(mapId: number, brightness: ActorMessages['setBrightness']['params'], callback: ActorMessages['setBrightness']['callback']) {
        this.brightness = brightness;
        callback();
    }

    setWorldview(mapId: number, worldview: ActorMessages['setWorldview']['params'], callback: ActorMessages['setWorldview']['callback']) {
        this.worldview = worldview;
        callback();
    }

    setLayers(mapId: number, params: ActorMessages['setLayers']['params'], callback: ActorMessages['setLayers']['callback']) {
        this.getLayerIndex(mapId, params.scope).replace(params.layers, params.options);
        callback();
    }

    updateLayers(mapId: number, params: ActorMessages['updateLayers']['params'], callback: ActorMessages['updateLayers']['callback']) {
        this.getLayerIndex(mapId, params.scope).update(params.layers, params.removedIds, params.options);
        callback();
    }

    loadTile(mapId: number, params: ActorMessages['loadTile']['params'], callback: ActorMessages['loadTile']['callback']) {
        assert(params.type);
        params.projection = this.projections[mapId] || this.defaultProjection;
        this.getWorkerSource(mapId, params.type, params.source, params.scope).loadTile(params, callback);
    }

    decodeRasterArray(mapId: number, params: ActorMessages['decodeRasterArray']['params'], callback: ActorMessages['decodeRasterArray']['callback']) {
        (this.getWorkerSource(mapId, params.type, params.source, params.scope) as RasterArrayTileWorkerSource).decodeRasterArray(params, callback);
    }

    reloadTile(mapId: number, params: ActorMessages['reloadTile']['params'], callback: ActorMessages['reloadTile']['callback']) {
        assert(params.type);
        params.projection = this.projections[mapId] || this.defaultProjection;
        this.getWorkerSource(mapId, params.type, params.source, params.scope).reloadTile(params, callback);
    }

    abortTile(mapId: number, params: ActorMessages['abortTile']['params'], callback: ActorMessages['abortTile']['callback']) {
        assert(params.type);
        this.getWorkerSource(mapId, params.type, params.source, params.scope).abortTile(params, callback);
    }

    removeTile(mapId: number, params: ActorMessages['removeTile']['params'], callback: ActorMessages['removeTile']['callback']) {
        assert(params.type);
        this.getWorkerSource(mapId, params.type, params.source, params.scope).removeTile(params, callback);
    }

    removeSource(mapId: number, params: ActorMessages['removeSource']['params'], callback: ActorMessages['removeSource']['callback']) {
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
    loadWorkerSource(mapId: number, params: ActorMessages['loadWorkerSource']['params'], callback: ActorMessages['loadWorkerSource']['callback']) {
        try {
            this.self.importScripts(params.url);
            callback();
        } catch (e) {
            callback(e.toString());
        }
    }

    syncRTLPluginState(mapId: number, state: ActorMessages['syncRTLPluginState']['params'], callback: ActorMessages['syncRTLPluginState']['callback']) {
        if (globalRTLTextPlugin.isParsed()) {
            callback(null, true);
            return;
        }
        if (globalRTLTextPlugin.isParsing()) {
            this.rtlPluginParsingListeners.push(callback);
            return;
        }
        try {
            globalRTLTextPlugin.setState(state);
            const pluginURL = globalRTLTextPlugin.getPluginURL();
            if (
                globalRTLTextPlugin.isLoaded() &&
                !globalRTLTextPlugin.isParsed() &&
                !globalRTLTextPlugin.isParsing() &&
                pluginURL != null // Not possible when `isLoaded` is true, but keeps flow happy
            ) {
                globalRTLTextPlugin.setState({
                    pluginStatus: rtlPluginStatus.parsing,
                    pluginURL: globalRTLTextPlugin.getPluginURL()
                });
                this.self.importScripts(pluginURL);

                if (globalRTLTextPlugin.isParsed()) {
                    callback(null, true);
                } else {
                    this.rtlPluginParsingListeners.push(callback);
                }
            }
        } catch (e) {
            callback(e.toString());
        }
    }

    setDracoUrl(mapId: number, dracoUrl: ActorMessages['setDracoUrl']['params']) {
        this.dracoUrl = dracoUrl;
    }

    getAvailableImages(mapId: number, scope: string): ImageId[] {
        if (!this.availableImages[mapId]) {
            this.availableImages[mapId] = {};
        }

        let availableImages = this.availableImages[mapId][scope];

        if (!availableImages) {
            availableImages = [];
        }

        return availableImages;
    }

    getAvailableModels(mapId: number, scope: string): StyleModelMap {
        if (!this.availableModels[mapId]) {
            this.availableModels[mapId] = {};
        }

        let availableModels = this.availableModels[mapId][scope];

        if (!availableModels) {
            availableModels = {};
        }

        return availableModels;
    }

    getLayerIndex(mapId: number, scope: string): StyleLayerIndex {
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

    getWorkerSource(mapId: number, type: string, source: string, scope: string): WorkerSource {
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
                send: <T extends ActorMessage>(type: T, data: ActorMessages[T]['params'], callback: ActorMessages[T]['callback'], _targetMapId: number, mustQueue: boolean, metadata: TaskMetadata) => {
                    return this.actor.send(type, data, callback, mapId, mustQueue, metadata);
                },
                scheduler: this.actor.scheduler
            } as Actor;

            workerSources[mapId][scope][type][source] = new this.workerSourceTypes[type](
                actor,
                this.getLayerIndex(mapId, scope),
                this.getAvailableImages(mapId, scope),
                this.getAvailableModels(mapId, scope),
                this.isSpriteLoaded[mapId][scope],
                undefined,
                this.brightness,
                this.worldview
            );
        }

        return workerSources[mapId][scope][type][source];
    }

    rasterizeImagesWorker(mapId: number, params: ActorMessages['rasterizeImagesWorker']['params'], callback: ActorMessages['rasterizeImagesWorker']['callback']) {
        const rasterizedImages: RasterizedImageMap = new Map();
        for (const [id, {image, imageVariant}] of params.tasks.entries()) {
            const rasterizedImage = this.imageRasterizer.rasterize(imageVariant, image, params.scope, mapId);
            rasterizedImages.set(id, rasterizedImage);
        }
        callback(undefined, rasterizedImages);
    }

    removeRasterizedImages(mapId: number, params: ActorMessages['removeRasterizedImages']['params'], callback: ActorMessages['removeRasterizedImages']['callback']) {
        this.imageRasterizer.removeImagesFromCacheByIds(params.imageIds, params.scope, mapId);
        callback();
    }

    enforceCacheSizeLimit(mapId: number, limit: ActorMessages['enforceCacheSizeLimit']['params']) {
        enforceCacheSizeLimit(limit);
    }

    getWorkerPerformanceMetrics(mapId: number, params: ActorMessages['getWorkerPerformanceMetrics']['params'], callback: ActorMessages['getWorkerPerformanceMetrics']['callback']) {
        callback(undefined, PerformanceUtils.getWorkerPerformanceMetrics());
    }
}

if (isWorker(self)) {
    self.worker = new MapWorker(self);
}
