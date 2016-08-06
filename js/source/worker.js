'use strict';

var Actor = require('../util/actor');
var StyleLayer = require('../style/style_layer');
var util = require('../util/util');

var VectorTileWorkerSource = require('./vector_tile_worker_source');
var GeoJSONWorkerSource = require('./geojson_worker_source');

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
            throw new Error('Worker source with name "' + name + '" already registered.');
        }
        this.workerSourceTypes[name] = WorkerSource;
    }.bind(this);
}

util.extend(Worker.prototype, {
    'set layers': function(mapId, layers) {
        var styleLayers = this.layers[mapId] = {};

        // Filter layers and create an id -> layer map
        var childLayerIndicies = [];
        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            if (layer.type === 'fill' || layer.type === 'line' || layer.type === 'circle' || layer.type === 'symbol') {
                if (layer.ref) {
                    childLayerIndicies.push(i);
                } else {
                    setLayer(layer);
                }
            }
        }

        // Create an instance of StyleLayer per layer
        for (var j = 0; j < childLayerIndicies.length; j++) {
            setLayer(layers[childLayerIndicies[j]]);
        }

        function setLayer(serializedLayer) {
            var styleLayer = StyleLayer.create(
                serializedLayer,
                serializedLayer.ref && styleLayers[serializedLayer.ref]
            );
            styleLayer.updatePaintTransitions({}, {transition: false});
            styleLayers[styleLayer.id] = styleLayer;
        }

        this.layerFamilies[mapId] = createLayerFamilies(this.layers[mapId]);
    },

    'update layers': function(mapId, layers) {
        var id;
        var layer;

        var styleLayers = this.layers[mapId];

        // Update ref parents
        for (id in layers) {
            layer = layers[id];
            if (layer.ref) updateLayer(layer);
        }

        // Update ref children
        for (id in layers) {
            layer = layers[id];
            if (!layer.ref) updateLayer(layer);
        }

        function updateLayer(layer) {
            var refLayer = styleLayers[layer.ref];
            if (styleLayers[layer.id]) {
                styleLayers[layer.id].set(layer, refLayer);
            } else {
                styleLayers[layer.id] = StyleLayer.create(layer, refLayer);
            }
            styleLayers[layer.id].updatePaintTransitions({}, {transition: false});
        }

        this.layerFamilies[mapId] = createLayerFamilies(this.layers[mapId]);
    },

    'load tile': function(mapId, params, callback) {
        var type = params.type || 'vector';
        this.getWorkerSource(mapId, type).loadTile(params, callback);
    },

    'reload tile': function(mapId, params, callback) {
        var type = params.type || 'vector';
        this.getWorkerSource(mapId, type).reloadTile(params, callback);
    },

    'abort tile': function(mapId, params) {
        var type = params.type || 'vector';
        this.getWorkerSource(mapId, type).abortTile(params);
    },

    'remove tile': function(mapId, params) {
        var type = params.type || 'vector';
        this.getWorkerSource(mapId, type).removeTile(params);
    },

    'redo placement': function(mapId, params, callback) {
        var type = params.type || 'vector';
        this.getWorkerSource(mapId, type).redoPlacement(params, callback);
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
            var styleLayers = {
                getLayers: function () { return this.layers[mapId]; }.bind(this),
                getLayerFamilies: function () { return this.layerFamilies[mapId]; }.bind(this)
            };
            this.workerSources[mapId][type] = new this.workerSourceTypes[type](this.actor, styleLayers);
        }

        return this.workerSources[mapId][type];
    }
});

function createLayerFamilies(layers) {
    var families = {};

    for (var layerId in layers) {
        var layer = layers[layerId];
        var parentLayerId = layer.ref || layer.id;
        var parentLayer = layers[parentLayerId];

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
