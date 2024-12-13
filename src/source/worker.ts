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

import type {ImageIdWithOptions} from '../style-spec/expression/types/image_id_with_options';
import type {
    WorkerSource,
    WorkerTileParameters,
    WorkerDEMTileParameters,
    WorkerTileCallback,
    WorkerDEMTileCallback,
    TileParameters,
    WorkerRasterArrayTileParameters,
    WorkerRasterArrayTileCallback,
    WorkerSourceConstructor,
    WorkerImageRaserizeCallback
} from './worker_source';
import type {Callback} from '../types/callback';
import type {LayerSpecification, ProjectionSpecification} from '../style-spec/types';
import type {ConfigOptions} from '../style/properties';
import type {RtlTextPlugin, PluginState} from './rtl_text_plugin';
import type Projection from '../geo/projection/projection';
import type {RGBAImage} from '../util/image';
import type {StyleImage} from '../style/style_image';

/**
 * @private
 */
export default class MapWorker {
    self: Worker;
    actor: Actor;
    layerIndexes: {
        [mapId: string]: {
            [scope: string]: StyleLayerIndex;
        };
    };
    availableImages: {
        [mapId: string]: {
            [scope: string]: Array<string>;
        };
    };
    workerSourceTypes: {
        [_: string]: WorkerSourceConstructor;
    };
    workerSources: {
        [mapId: string]: {
            [scope: string]: {
                [sourceType: string]: {
                    [sourceId: string]: WorkerSource;
                };
            };
        };
    };
    demWorkerSources: {
        [mapId: string]: {
            [scope: string]: {
                [sourceId: string]: RasterDEMTileWorkerSource;
            };
        };
    };
    rasterArrayWorkerSource: RasterArrayTileWorkerSource | null | undefined;
    projections: {
        [_: string]: Projection;
    };
    defaultProjection: Projection;
    isSpriteLoaded: {
        [mapId: string]: {
            [scope: string]: boolean;
        };
    };
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
            vector: VectorTileWorkerSource,
            geojson: GeoJSONWorkerSource,
            'batched-model': Tiled3dModelWorkerSource
        };

        // [mapId][scope][sourceType][sourceName] => worker source instance
        this.workerSources = {};
        this.demWorkerSources = {};

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

    clearCaches(mapId: string, unused: unknown, callback: WorkerTileCallback) {
        delete this.layerIndexes[mapId];
        delete this.availableImages[mapId];
        delete this.workerSources[mapId];
        delete this.demWorkerSources[mapId];
        delete this.rasterArrayWorkerSource;
        callback();
    }

    checkIfReady(mapID: string, unused: unknown, callback: WorkerTileCallback) {
        // noop, used to check if a worker is fully set up and ready to receive messages
        callback();
    }

    setReferrer(mapID: string, referrer: string) {
        this.referrer = referrer;
    }

    spriteLoaded(mapId: string, {
        scope,
        isLoaded,
    }: {
        scope: string;
        isLoaded: boolean;
    }) {
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

    setImages(mapId: string, {
        scope,
        images,
    }: {
        scope: string;
        images: Array<string>;
    }, callback: WorkerTileCallback) {
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

    setBrightness(mapId: string, brightness: number | null | undefined, callback: WorkerTileCallback) {
        this.brightness = brightness;
        callback();
    }

    setLayers(mapId: string, params: {
        layers: Array<LayerSpecification>;
        scope: string;
        options: ConfigOptions;
    }, callback: WorkerTileCallback) {
        this.getLayerIndex(mapId, params.scope).replace(params.layers, params.options);
        callback();
    }

    updateLayers(mapId: string, params: {
        layers: Array<LayerSpecification>;
        scope: string;
        removedIds: Array<string>;
        options: ConfigOptions;
    }, callback: WorkerTileCallback) {
        this.getLayerIndex(mapId, params.scope).update(params.layers, params.removedIds, params.options);
        callback();
    }

    loadTile(mapId: string, params: WorkerTileParameters & {
        type: string;
    }, callback: WorkerTileCallback) {
        assert(params.type);
        params.projection = this.projections[mapId] || this.defaultProjection;
        this.getWorkerSource(mapId, params.type, params.source, params.scope).loadTile(params, callback);
    }

    loadDEMTile(mapId: string, params: WorkerDEMTileParameters, callback: WorkerDEMTileCallback) {
        this.getDEMWorkerSource(mapId, params.source, params.scope).loadTile(params, callback);
    }

    decodeRasterArray(mapId: string, params: WorkerRasterArrayTileParameters, callback: WorkerRasterArrayTileCallback) {
        this.getRasterArrayWorkerSource().decodeRasterArray(params, callback);
    }

    reloadTile(mapId: string, params: WorkerTileParameters & {
        type: string;
    }, callback: WorkerTileCallback) {
        assert(params.type);
        params.projection = this.projections[mapId] || this.defaultProjection;
        this.getWorkerSource(mapId, params.type, params.source, params.scope).reloadTile(params, callback);
    }

    abortTile(mapId: string, params: TileParameters & {
        type: string;
    }, callback: WorkerTileCallback) {
        assert(params.type);
        this.getWorkerSource(mapId, params.type, params.source, params.scope).abortTile(params, callback);
    }

    removeTile(mapId: string, params: TileParameters & {
        type: string;
    }, callback: WorkerTileCallback) {
        assert(params.type);
        this.getWorkerSource(mapId, params.type, params.source, params.scope).removeTile(params, callback);
    }

    removeSource(mapId: string, params: {
        source: string;
        scope: string;
        type: string;
    }, callback: WorkerTileCallback) {
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

    getAvailableImages(mapId: string, scope: string): Array<string> {
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
        if (!this.workerSources[mapId])
            this.workerSources[mapId] = {};
        if (!this.workerSources[mapId][scope])
            this.workerSources[mapId][scope] = {};
        if (!this.workerSources[mapId][scope][type])
            this.workerSources[mapId][scope][type] = {};
        if (!this.isSpriteLoaded[mapId])
            this.isSpriteLoaded[mapId] = {};

        if (!this.workerSources[mapId][scope][type][source]) {
            // use a wrapped actor so that we can attach a target mapId param
            // to any messages invoked by the WorkerSource
            const actor = {
                send: (type: string, data: unknown, callback: any, _: any, mustQueue: boolean, metadata: any) => {
                    this.actor.send(type, data, callback, mapId, mustQueue, metadata);
                },
                scheduler: this.actor.scheduler
            } as Actor;

            this.workerSources[mapId][scope][type][source] = new this.workerSourceTypes[type](
                actor,
                this.getLayerIndex(mapId, scope),
                this.getAvailableImages(mapId, scope),
                this.isSpriteLoaded[mapId][scope],
                undefined,
                this.brightness
            );
        }

        return this.workerSources[mapId][scope][type][source];
    }

    rasterizeImages(mapId: string, input: {imageTasks: {[_: string]:  {image: StyleImage, imageIdWithOptions: ImageIdWithOptions}}, scope: string}, callback: WorkerImageRaserizeCallback) {
        const {imageTasks, scope} = input;
        const images: {[key: string]: RGBAImage} = {};
        for (const id in imageTasks) {
            const {image, imageIdWithOptions} = imageTasks[id];
            images[id] = this.imageRasterizer.rasterize(imageIdWithOptions, image, scope, mapId);
        }
        callback(undefined, images);
    }

    removeRasterizedImages(mapId: string, input: {imageIds: Array<string>, scope: string}, callback: WorkerTileCallback) {
        const {imageIds, scope} = input;
        this.imageRasterizer.removeImagesFromCacheByIds(imageIds, scope, mapId);
        callback();
    }

    getDEMWorkerSource(mapId: string, source: string, scope: string): RasterDEMTileWorkerSource {
        if (!this.demWorkerSources[mapId])
            this.demWorkerSources[mapId] = {};

        if (!this.demWorkerSources[mapId][scope])
            this.demWorkerSources[mapId][scope] = {};

        if (!this.demWorkerSources[mapId][scope][source]) {
            this.demWorkerSources[mapId][scope][source] = new RasterDEMTileWorkerSource();
        }

        return this.demWorkerSources[mapId][scope][source];
    }

    getRasterArrayWorkerSource(): RasterArrayTileWorkerSource {
        if (!this.rasterArrayWorkerSource) {
            this.rasterArrayWorkerSource = new RasterArrayTileWorkerSource();
        }

        return this.rasterArrayWorkerSource;
    }

    enforceCacheSizeLimit(mapId: string, limit: number) {
        enforceCacheSizeLimit(limit);
    }

    getWorkerPerformanceMetrics(mapId: string, params: any, callback: (error?: Error, result?: any) => void) {
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
