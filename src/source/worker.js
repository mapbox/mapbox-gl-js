// @flow

import Actor from '../util/actor';

import StyleLayerIndex from '../style/style_layer_index';
import VectorTileWorkerSource from './vector_tile_worker_source';
import RasterDEMTileWorkerSource from './raster_dem_tile_worker_source';
import GeoJSONWorkerSource from './geojson_worker_source';
import assert from 'assert';
import {plugin as globalRTLTextPlugin} from './rtl_text_plugin';
import {enforceCacheSizeLimit} from '../util/tile_request_cache';
import {extend} from '../util/util';
import {PerformanceUtils} from '../util/performance';
import {Event} from '../util/evented';

import type {
    WorkerSource,
    WorkerTileParameters,
    WorkerDEMTileParameters,
    WorkerTileCallback,
    WorkerDEMTileCallback,
    TileParameters
} from '../source/worker_source';

import type {WorkerGlobalScopeInterface} from '../util/web_worker';
import type {Callback} from '../types/callback';
import type {LayerSpecification} from '../style-spec/types';
import type {PluginState} from './rtl_text_plugin';

/**
 * @private
 */
export default class Worker {
    self: WorkerGlobalScopeInterface;
    actor: Actor;
    layerIndexes: {[_: string]: StyleLayerIndex };
    availableImages: {[_: string]: Array<string> };
    workerSourceTypes: {[_: string]: Class<WorkerSource> };
    workerSources: {[_: string]: {[_: string]: {[_: string]: WorkerSource } } };
    demWorkerSources: {[_: string]: {[_: string]: RasterDEMTileWorkerSource } };
    isSpriteLoaded: boolean;
    referrer: ?string;
    terrain: ?boolean;

    constructor(self: WorkerGlobalScopeInterface) {
        PerformanceUtils.measure('workerEvaluateScript');
        this.self = self;
        this.actor = new Actor(self, this);

        this.layerIndexes = {};
        this.availableImages = {};
        this.isSpriteLoaded = false;

        this.workerSourceTypes = {
            vector: VectorTileWorkerSource,
            geojson: GeoJSONWorkerSource
        };

        // [mapId][sourceType][sourceName] => worker source instance
        this.workerSources = {};
        this.demWorkerSources = {};

        this.self.registerWorkerSource = (name: string, WorkerSource: Class<WorkerSource>) => {
            if (this.workerSourceTypes[name]) {
                throw new Error(`Worker source with name "${name}" already registered.`);
            }
            this.workerSourceTypes[name] = WorkerSource;
        };

        // This is invoked by the RTL text plugin when the download via the `importScripts` call has finished, and the code has been parsed.
        this.self.registerRTLTextPlugin = (rtlTextPlugin: {applyArabicShaping: Function, processBidirectionalText: Function, processStyledBidirectionalText?: Function}) => {
            if (globalRTLTextPlugin.isParsed()) {
                throw new Error('RTL text plugin already registered.');
            }
            globalRTLTextPlugin['applyArabicShaping'] = rtlTextPlugin.applyArabicShaping;
            globalRTLTextPlugin['processBidirectionalText'] = rtlTextPlugin.processBidirectionalText;
            globalRTLTextPlugin['processStyledBidirectionalText'] = rtlTextPlugin.processStyledBidirectionalText;
        };
    }

    checkIfReady(mapID: string, unused: mixed, callback: WorkerTileCallback) {
        // noop, used to check if a worker is fully set up and ready to receive messages
        callback();
    }

    setReferrer(mapID: string, referrer: string) {
        this.referrer = referrer;
    }

    spriteLoaded(mapId: string, bool: boolean) {
        this.isSpriteLoaded = bool;
        for (const workerSource in this.workerSources[mapId]) {
            const ws = this.workerSources[mapId][workerSource];
            for (const source in ws) {
                if (ws[source] instanceof VectorTileWorkerSource) {
                    ws[source].isSpriteLoaded = bool;
                    ws[source].fire(new Event('isSpriteLoaded'));
                }
            }
        }
    }

    setImages(mapId: string, images: Array<string>, callback: WorkerTileCallback) {
        this.availableImages[mapId] = images;
        for (const workerSource in this.workerSources[mapId]) {
            const ws = this.workerSources[mapId][workerSource];
            for (const source in ws) {
                ws[source].availableImages = images;
            }
        }
        callback();
    }

    enableTerrain(mapId: string, enable: boolean, callback: WorkerTileCallback) {
        this.terrain = enable;
        callback();
    }

    setLayers(mapId: string, layers: Array<LayerSpecification>, callback: WorkerTileCallback) {
        this.getLayerIndex(mapId).replace(layers);
        callback();
    }

    updateLayers(mapId: string, params: {layers: Array<LayerSpecification>, removedIds: Array<string>}, callback: WorkerTileCallback) {
        this.getLayerIndex(mapId).update(params.layers, params.removedIds);
        callback();
    }

    loadTile(mapId: string, params: WorkerTileParameters & {type: string}, callback: WorkerTileCallback) {
        assert(params.type);
        const p = this.enableTerrain ? extend({enableTerrain: this.terrain}, params) : params;
        this.getWorkerSource(mapId, params.type, params.source).loadTile(p, callback);
    }

    loadDEMTile(mapId: string, params: WorkerDEMTileParameters, callback: WorkerDEMTileCallback) {
        const p = this.enableTerrain ? extend({buildQuadTree: this.terrain}, params) : params;
        this.getDEMWorkerSource(mapId, params.source).loadTile(p, callback);
    }

    reloadTile(mapId: string, params: WorkerTileParameters & {type: string}, callback: WorkerTileCallback) {
        assert(params.type);
        const p = this.enableTerrain ? extend({enableTerrain: this.terrain}, params) : params;
        this.getWorkerSource(mapId, params.type, params.source).reloadTile(p, callback);
    }

    abortTile(mapId: string, params: TileParameters & {type: string}, callback: WorkerTileCallback) {
        assert(params.type);
        this.getWorkerSource(mapId, params.type, params.source).abortTile(params, callback);
    }

    removeTile(mapId: string, params: TileParameters & {type: string}, callback: WorkerTileCallback) {
        assert(params.type);
        this.getWorkerSource(mapId, params.type, params.source).removeTile(params, callback);
    }

    removeSource(mapId: string, params: {source: string} & {type: string}, callback: WorkerTileCallback) {
        assert(params.type);
        assert(params.source);

        if (!this.workerSources[mapId] ||
            !this.workerSources[mapId][params.type] ||
            !this.workerSources[mapId][params.type][params.source]) {
            return;
        }

        const worker = this.workerSources[mapId][params.type][params.source];
        delete this.workerSources[mapId][params.type][params.source];

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
    loadWorkerSource(map: string, params: { url: string }, callback: Callback<void>) {
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
        } catch (e) {
            callback(e.toString());
        }
    }

    getAvailableImages(mapId: string) {
        let availableImages = this.availableImages[mapId];

        if (!availableImages) {
            availableImages = [];
        }

        return availableImages;
    }

    getLayerIndex(mapId: string) {
        let layerIndexes = this.layerIndexes[mapId];
        if (!layerIndexes) {
            layerIndexes = this.layerIndexes[mapId] = new StyleLayerIndex();
        }
        return layerIndexes;
    }

    getWorkerSource(mapId: string, type: string, source: string) {
        if (!this.workerSources[mapId])
            this.workerSources[mapId] = {};
        if (!this.workerSources[mapId][type])
            this.workerSources[mapId][type] = {};

        if (!this.workerSources[mapId][type][source]) {
            // use a wrapped actor so that we can attach a target mapId param
            // to any messages invoked by the WorkerSource
            const actor = {
                send: (type, data, callback, mustQueue, _, metadata) => {
                    this.actor.send(type, data, callback, mapId, mustQueue, metadata);
                },
                scheduler: this.actor.scheduler
            };
            this.workerSources[mapId][type][source] = new (this.workerSourceTypes[type]: any)((actor: any), this.getLayerIndex(mapId), this.getAvailableImages(mapId), this.isSpriteLoaded);
        }

        return this.workerSources[mapId][type][source];
    }

    getDEMWorkerSource(mapId: string, source: string) {
        if (!this.demWorkerSources[mapId])
            this.demWorkerSources[mapId] = {};

        if (!this.demWorkerSources[mapId][source]) {
            this.demWorkerSources[mapId][source] = new RasterDEMTileWorkerSource();
        }

        return this.demWorkerSources[mapId][source];
    }

    enforceCacheSizeLimit(mapId: string, limit: number) {
        enforceCacheSizeLimit(limit);
    }

    getWorkerPerformanceMetrics(mapId: string, params: any, callback: (error: ?Error, result: ?Object) => void) {
        callback(undefined, PerformanceUtils.getWorkerPerformanceMetrics());
    }
}

/* global self, WorkerGlobalScope */
if (typeof WorkerGlobalScope !== 'undefined' &&
    typeof self !== 'undefined' &&
    self instanceof WorkerGlobalScope) {
    self.worker = new Worker(self);
}
