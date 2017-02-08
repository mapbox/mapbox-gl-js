'use strict';

const Actor = require('../util/actor');
const StyleLayerIndex = require('../style/style_layer_index');

const VectorTileWorkerSource = require('./vector_tile_worker_source');
const GeoJSONWorkerSource = require('./geojson_worker_source');
const assert = require('assert');

const globalRTLTextPlugin = require('./rtl_text_plugin');

/**
 * @private
 */
class Worker {
    constructor(self) {
        this.self = self;
        this.actor = new Actor(self, this);

        this.layerIndexes = {};

        this.workerSourceTypes = {
            vector: VectorTileWorkerSource,
            geojson: GeoJSONWorkerSource
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

    setLayers(mapId, layers) {
        this.getLayerIndex(mapId).replace(layers);
    }

    updateLayers(mapId, params) {
        this.getLayerIndex(mapId).update(params.layers, params.removedIds, params.symbolOrder);
    }

    loadTile(mapId, params, callback) {
        assert(params.type);
        this.getWorkerSource(mapId, params.type).loadTile(params, callback);
    }

    reloadTile(mapId, params, callback) {
        assert(params.type);
        this.getWorkerSource(mapId, params.type).reloadTile(params, callback);
    }

    abortTile(mapId, params) {
        assert(params.type);
        this.getWorkerSource(mapId, params.type).abortTile(params);
    }

    removeTile(mapId, params) {
        assert(params.type);
        this.getWorkerSource(mapId, params.type).removeTile(params);
    }

    removeSource(mapId, params) {
        assert(params.type);
        const worker = this.getWorkerSource(mapId, params.type);
        if (worker.removeSource !== undefined) {
            worker.removeSource(params);
        }
    }

    redoPlacement(mapId, params, callback) {
        assert(params.type);
        this.getWorkerSource(mapId, params.type).redoPlacement(params, callback);
    }

    /**
     * Load a {@link WorkerSource} script at params.url.  The script is run
     * (using importScripts) with `registerWorkerSource` in scope, which is a
     * function taking `(name, workerSourceObject)`.
     *  @private
     */
    loadWorkerSource(map, params, callback) {
        try {
            this.self.importScripts(params.url);
            callback();
        } catch (e) {
            callback(e);
        }
    }

    loadRTLTextPlugin(map, pluginURL, callback) {
        try {
            if (!globalRTLTextPlugin.applyArabicShaping && !globalRTLTextPlugin.processBidirectionalText) {
                this.self.importScripts(pluginURL);
            }
        } catch (e) {
            callback(e);
        }
    }

    getLayerIndex(mapId) {
        let layerIndexes = this.layerIndexes[mapId];
        if (!layerIndexes) {
            layerIndexes = this.layerIndexes[mapId] = new StyleLayerIndex();
        }
        return layerIndexes;
    }

    getWorkerSource(mapId, type) {
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

module.exports = function createWorker(self) {
    return new Worker(self);
};
