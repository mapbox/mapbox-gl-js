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

    // simple accessor object for passing to WorkerSources
    var styleLayers = {
        getLayers: function () { return this.layers; }.bind(this),
        getLayerFamilies: function () { return this.layerFamilies; }.bind(this)
    };

    this.workerSources = {
        vector: new VectorTileWorkerSource(this.actor, styleLayers),
        geojson: new GeoJSONWorkerSource(this.actor, styleLayers)
    };

    this.self.registerWorkerSource = function (name, WorkerSource) {
        if (this.workerSources[name]) {
            throw new Error('Worker source with name "' + name + '" already registered.');
        }
        this.workerSources[name] = new WorkerSource(this.actor, styleLayers);
    }.bind(this);
}

util.extend(Worker.prototype, {
    'set layers': function(layers) {
        this.layers = {};
        var that = this;

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
                serializedLayer.ref && that.layers[serializedLayer.ref]
            );
            styleLayer.updatePaintTransitions({}, {transition: false});
            that.layers[styleLayer.id] = styleLayer;
        }

        this.layerFamilies = createLayerFamilies(this.layers);
    },

    'update layers': function(layers) {
        var that = this;
        var id;
        var layer;

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
            var refLayer = that.layers[layer.ref];
            if (that.layers[layer.id]) {
                that.layers[layer.id].set(layer, refLayer);
            } else {
                that.layers[layer.id] = StyleLayer.create(layer, refLayer);
            }
            that.layers[layer.id].updatePaintTransitions({}, {transition: false});
        }

        this.layerFamilies = createLayerFamilies(this.layers);
    },

    'load tile': function(params, callback) {
        var type = params.type || 'vector';
        this.workerSources[type].loadTile(params, callback);
    },

    'reload tile': function(params, callback) {
        var type = params.type || 'vector';
        this.workerSources[type].reloadTile(params, callback);
    },

    'abort tile': function(params) {
        var type = params.type || 'vector';
        this.workerSources[type].abortTile(params);
    },

    'remove tile': function(params) {
        var type = params.type || 'vector';
        this.workerSources[type].removeTile(params);
    },

    'redo placement': function(params, callback) {
        var type = params.type || 'vector';
        this.workerSources[type].redoPlacement(params, callback);
    },

    /**
     * Load a {@link WorkerSource} script at params.url.  The script is run
     * (using importScripts) with `registerWorkerSource` in scope, which is a
     * function taking `(name, workerSourceObject)`.
     *  @private
     */
    'load worker source': function(params, callback) {
        try {
            this.self.importScripts(params.url);
            callback();
        } catch (e) {
            callback(e);
        }
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
