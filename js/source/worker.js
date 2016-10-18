'use strict';

const Actor = require('../util/actor');
const StyleLayer = require('../style/style_layer');
const util = require('../util/util');

const VectorTileWorkerSource = require('./vector_tile_worker_source');
const GeoJSONWorkerSource = require('./geojson_worker_source');
const featureFilter = require('feature-filter');
const assert = require('assert');

module.exports = function createWorker(self) {
    return new Worker(self);
};

function Worker(self) {
    this.self = self;
    this.actor = new Actor(self, this);

    this.layers = {};
    this.layerFamilies = {};

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
        this.layers[mapId] = {};
        this['update layers'](mapId, layerDefinitions);
    },

    'update layers': function(mapId, layerDefinitions) {
        const layers = this.layers[mapId];

        // Update ref parents
        for (const layer of layerDefinitions) {
            if (!layer.ref) updateLayer(layer);
        }

        // Update ref children
        for (const layer of layerDefinitions) {
            if (layer.ref) updateLayer(layer);
        }

        function updateLayer(layer) {
            if (layer.type !== 'fill' && layer.type !== 'line' && layer.type !== 'circle' && layer.type !== 'symbol')
                return;
            const refLayer = layer.ref && layers[layer.ref];
            let styleLayer = layers[layer.id];
            if (styleLayer) {
                styleLayer.set(layer, refLayer);
            } else {
                styleLayer = layers[layer.id] = StyleLayer.create(layer, refLayer);
            }
            styleLayer.updatePaintTransitions({}, {transition: false});
            styleLayer.filter = featureFilter(styleLayer.filter);
        }

        this.layerFamilies[mapId] = createLayerFamilies(this.layers[mapId]);
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

    getWorkerSource: function(mapId, type) {
        if (!this.workerSources[mapId])
            this.workerSources[mapId] = {};
        if (!this.workerSources[mapId][type]) {
            // simple accessor object for passing to WorkerSources
            const layers = {
                getLayers: () => this.layers[mapId],
                getLayerFamilies: () => this.layerFamilies[mapId]
            };

            // use a wrapped actor so that we can attach a target mapId param
            // to any messages invoked by the WorkerSource
            const actor = {
                send: (type, data, callback, buffers) => {
                    this.actor.send(type, data, callback, buffers, mapId);
                }
            };

            this.workerSources[mapId][type] = new this.workerSourceTypes[type](actor, layers);
        }

        return this.workerSources[mapId][type];
    }
});

function createLayerFamilies(layers) {
    const families = {};

    for (const layerId in layers) {
        const layer = layers[layerId];
        const parentLayerId = layer.ref || layer.id;
        const parentLayer = layers[parentLayerId];

        if (parentLayer.layout && parentLayer.layout.visibility === 'none') continue;

        families[parentLayerId] = families[parentLayerId] || [];
        if (layerId === parentLayerId) {
            families[parentLayerId].unshift(layer);
        } else {
            families[parentLayerId].push(layer);
        }
    }

    return families;
}
