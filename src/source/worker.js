// @flow

const Actor = require('../util/actor');
const StyleLayerIndex = require('../style/style_layer_index');

const VectorTileWorkerSource = require('./vector_tile_worker_source');
const GeoJSONWorkerSource = require('./geojson_worker_source');
const RasterTerrainTileWorkerSource = require('./raster_terrain_tile_worker_source');
const assert = require('assert');

const globalRTLTextPlugin = require('./rtl_text_plugin');

import type {
    WorkerSource,
    WorkerTileParameters,
    WorkerTileCallback,
    TileParameters,
    RedoPlacementParameters,
    RedoPlacementCallback
} from '../source/source';

/**
 * @private
 */
class Worker {
    self: WorkerGlobalScope & {
        registerWorkerSource: (string, Class<WorkerSource>) => void,
        registerRTLTextPlugin: (any) => void
    };
    actor: Actor;
    layerIndexes: { [string]: StyleLayerIndex };
    workerSourceTypes: { [string]: Class<WorkerSource> };
    workerSources: { [string]: { [string]: WorkerSource } };

    constructor(self: WorkerGlobalScope) {
        this.self = (self: any); // Needs a cast because we're going to extend it with `register*` methods.
        this.actor = new Actor(self, this);

        this.layerIndexes = {};

        this.workerSourceTypes = {
            vector: VectorTileWorkerSource,
            geojson: GeoJSONWorkerSource,
            'raster-terrain': RasterTerrainTileWorkerSource
        };

        // [mapId][sourceType] => worker source instance
        this.workerSources = {};

        this.self.registerWorkerSource = (name, WorkerSource) => {
            if (this.workerSourceTypes[name]) {
                throw new Error(`Worker source with name "${name}" already registered.`);
            }
            this.workerSourceTypes[name] = WorkerSource;
        };

        this.self.registerRTLTextPlugin = (rtlTextPlugin) => {
            if (globalRTLTextPlugin.applyArabicShaping || globalRTLTextPlugin.processBidirectionalText) {
                throw new Error('RTL text plugin already registered.');
            }
            globalRTLTextPlugin['applyArabicShaping'] = rtlTextPlugin.applyArabicShaping;
            globalRTLTextPlugin['processBidirectionalText'] = rtlTextPlugin.processBidirectionalText;
        };
    }

    setLayers(mapId: string, layers: any) {
        this.getLayerIndex(mapId).replace(layers);
    }

    updateLayers(mapId: string, params: {layers: any, removedIds: any, symbolOrder: any}) {
        this.getLayerIndex(mapId).update(params.layers, params.removedIds, params.symbolOrder);
    }

    loadTile(mapId: string, params: WorkerTileParameters & {type: string}, callback: WorkerTileCallback) {
        assert(params.type);
        this.getWorkerSource(mapId, params.type).loadTile(params, callback);
    }

    reloadTile(mapId: string, params: WorkerTileParameters & {type: string}, callback: WorkerTileCallback) {
        assert(params.type);
        this.getWorkerSource(mapId, params.type).reloadTile(params, callback);
    }

    abortTile(mapId: string, params: TileParameters & {type: string}) {
        assert(params.type);
        this.getWorkerSource(mapId, params.type).abortTile(params);
    }

    removeTile(mapId: string, params: TileParameters & {type: string}) {
        assert(params.type);
        this.getWorkerSource(mapId, params.type).removeTile(params);
    }

    removeSource(mapId: string, params: {source: string} & {type: string}) {
        assert(params.type);
        const worker = this.getWorkerSource(mapId, params.type);
        if (worker.removeSource !== undefined) {
            worker.removeSource(params);
        }
    }

    redoPlacement(mapId: string, params: RedoPlacementParameters & {type: string}, callback: RedoPlacementCallback) {
        assert(params.type);
        this.getWorkerSource(mapId, params.type).redoPlacement(params, callback);
    }

    /**
     * Load a {@link WorkerSource} script at params.url.  The script is run
     * (using importScripts) with `registerWorkerSource` in scope, which is a
     * function taking `(name, workerSourceObject)`.
     *  @private
     */
    loadWorkerSource(map: string, params: {url: string}, callback: Callback<void>) {
        try {
            this.self.importScripts(params.url);
            callback();
        } catch (e) {
            callback(e);
        }
    }

    loadRTLTextPlugin(map: string, pluginURL: string, callback: Callback<void>) {
        try {
            if (!globalRTLTextPlugin.applyArabicShaping && !globalRTLTextPlugin.processBidirectionalText) {
                this.self.importScripts(pluginURL);
                if (!globalRTLTextPlugin.applyArabicShaping || !globalRTLTextPlugin.processBidirectionalText) {
                    callback(new Error(`RTL Text Plugin failed to import scripts from ${pluginURL}`));
                }
            }
        } catch (e) {
            callback(e);
        }
    }

    getLayerIndex(mapId: string) {
        let layerIndexes = this.layerIndexes[mapId];
        if (!layerIndexes) {
            layerIndexes = this.layerIndexes[mapId] = new StyleLayerIndex();
        }
        return layerIndexes;
    }

    getWorkerSource(mapId: string, type: string) {
        if (!this.workerSources[mapId])
            this.workerSources[mapId] = {};
        if (!this.workerSources[mapId][type]) {
            // use a wrapped actor so that we can attach a target mapId param
            // to any messages invoked by the WorkerSource
            const actor = {
                send: (type, data, callback, buffers) => {
                    this.actor.send(type, data, callback, buffers, mapId);
                }
            };

            this.workerSources[mapId][type] = new this.workerSourceTypes[type](actor, this.getLayerIndex(mapId));
        }

        return this.workerSources[mapId][type];
    }
}

module.exports = function createWorker(self: WorkerGlobalScope) {
    return new Worker(self);
};
