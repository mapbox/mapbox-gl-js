'use strict';

const Actor = require('../util/actor');
const StyleLayerIndex = require('../style/style_layer_index');
const util = require('../util/util');

const VectorTileWorkerSource = require('./vector_tile_worker_source');
const GeoJSONWorkerSource = require('./geojson_worker_source');
const assert = require('assert');

module.exports = function createWorker(self) {
    return new Worker(self);
};

function Worker(self) {
    this.self = self;
    this.actor = new Actor(self, this);

    this.layerIndexes = {};

    this.workerSourceTypes = {
        vector: VectorTileWorkerSource,
        geojson: GeoJSONWorkerSource
    };

    // [mapId][sourceType] => worker source instance
    this.workerSources = {};

    this.self.registerWorkerSource = function (name, WorkerSource) {
        if (this.workerSourceTypes[name]) {
            throw new Error(`Worker source with name "${name}" already registered.`);
        }
        this.workerSourceTypes[name] = WorkerSource;
    }.bind(this);
}

util.extend(Worker.prototype, {
    'set layers': function(mapId, layerDefinitions) {
        this.getLayerIndex(mapId).replace(layerDefinitions);
    },

    'update layers': function(mapId, layerDefinitions) {
        this.getLayerIndex(mapId).update(layerDefinitions);
    },

    'load tile': function(mapId, params, callback) {
        assert(params.type);
        this.getWorkerSource(mapId, params.type).loadTile(params, callback);
    },

    'reload tile': function(mapId, params, callback) {
        assert(params.type);
        this.getWorkerSource(mapId, params.type).reloadTile(params, callback);
    },

    'abort tile': function(mapId, params) {
        assert(params.type);
        this.getWorkerSource(mapId, params.type).abortTile(params);
    },

    'remove tile': function(mapId, params) {
        assert(params.type);
        this.getWorkerSource(mapId, params.type).removeTile(params);
    },

    'redo placement': function(mapId, params, callback) {
        assert(params.type);
        this.getWorkerSource(mapId, params.type).redoPlacement(params, callback);
    },

    /**
     * Load a {@link WorkerSource} script at params.url.  The script is run
     * (using importScripts) with `registerWorkerSource` in scope, which is a
     * function taking `(name, workerSourceObject)`.
     *  @private
     */
    'load worker source': function(map, params, callback) {
        try {
            this.self.importScripts(params.url);
            callback();
        } catch (e) {
            callback(e);
        }
    },

    getLayerIndex: function(mapId) {
        let layerIndexes = this.layerIndexes[mapId];
        if (!layerIndexes) {
            layerIndexes = this.layerIndexes[mapId] = new StyleLayerIndex();
        }
        return layerIndexes;
    },

    getWorkerSource: function(mapId, type) {
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
});
