'use strict';

var assert = require('assert');
var Actor = require('../util/actor');
var StyleLayer = require('../style/style_layer');
var util = require('../util/util');

var VectorTileWorkerSource = require('./vector_tile_worker_source');
var GeoJSONWorkerSource = require('./geojson_worker_source');

module.exports = function(self) {
    return new Worker(self);
};

function Worker(self) {
    this.self = self;
    this.actor = new Actor(self, this);

    this.styles = {};
    this.layers = {};
    this.layerFamilies = {};

    // simple accessor object for passing to WorkerSources
    var styleLayers = {
        getKey: function (map) {
            return this.styles[map];
        }.bind(this),
        getLayers: function (map) {
            return this.layers[this.styles[map]];
        }.bind(this),
        getLayerFamilies: function (map) {
            return this.layerFamilies[this.styles[map]];
        }.bind(this)
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
    'set style': function(map, style) {
        // this.styles is an object mapping map id to a content-based key for
        // the map instance's style. ideally, the key should be the same for
        // two map instances whose style is identical.
        var key = createKeyForStyle(style);

        var prevKey = this.styles[map];
        if (prevKey === key) return;
        this.styles[map] = key;

        var shouldDeletePreviousLayers = util.values(this.styles)
            .some(function (usedKey) { return usedKey === prevKey; });
        if (shouldDeletePreviousLayers) {
            delete this.layers[prevKey];
            delete this.layerFamilies[prevKey];
        }

        if (this.layers[key]) return;

        var styleLayers = this.layers[key] = {};

        // Filter layers and create an id -> layer map
        var childLayerIndicies = [];
        for (var i = 0; i < style.layers.length; i++) {
            var layer = style.layers[i];
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
            setLayer(style.layers[childLayerIndicies[j]]);
        }

        this.layerFamilies[key] = createLayerFamilies(styleLayers);

        function setLayer(serializedLayer) {
            var styleLayer = StyleLayer.create(
                serializedLayer,
                serializedLayer.ref && styleLayers[serializedLayer.ref]
            );
            styleLayer.updatePaintTransitions({}, {transition: false});
            styleLayers[styleLayer.id] = styleLayer;
        }
    },

    'update style': function(map, style) {
        var that = this;
        var id;
        var layer;

        var key = createKeyForStyle(style);

        var prevKey = this.styles[map];
        if (prevKey === key) return;
        assert(this.layers[prevKey]);

        this.styles[map] = key;

        // if the current style is being used by another map instance, then
        // delegate to 'set style'.
        var existingStyleIsUsed = util.values(this.styles)
            .some(function (usedKey) { return usedKey === prevKey; });
        if (existingStyleIsUsed)
            return this['set style'](map, style);

        var prevLayers = this.layers[prevKey];
        delete this.layers[prevKey];
        delete this.layerFamilies[prevKey];

        if (this.layers[key]) return;

        this.layers[key] = prevLayers;

        // Update ref parents
        for (id in style.layers) {
            layer = style.layers[id];
            if (layer.ref) updateLayer(layer);
        }

        // Update ref children
        for (id in style.layers) {
            layer = style.layers[id];
            if (!layer.ref) updateLayer(layer);
        }

        this.layerFamilies[key] = createLayerFamilies(this.layers);

        function updateLayer(layer) {
            var refLayer = that.layers[prevKey][layer.ref];
            if (that.layers[prevKey][layer.id]) {
                that.layers[layer.id].set(layer, refLayer);
            } else {
                that.layers[layer.id] = StyleLayer.create(layer, refLayer);
            }
            that.layers[layer.id].updatePaintTransitions({}, {transition: false});
        }
    },

    'load tile': function(map, params, callback) {
        var type = params.type || 'vector';
        this.workerSources[type].loadTile(map, params, callback);
    },

    'reload tile': function(map, params, callback) {
        var type = params.type || 'vector';
        this.workerSources[type].reloadTile(map, params, callback);
    },

    'abort tile': function(map, params) {
        var type = params.type || 'vector';
        this.workerSources[type].abortTile(map, params);
    },

    'remove tile': function(map, params) {
        var type = params.type || 'vector';
        this.workerSources[type].removeTile(map, params);
    },

    'redo placement': function(map, params, callback) {
        var type = params.type || 'vector';
        this.workerSources[type].redoPlacement(map, params, callback);
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

function createKeyForStyle(style) {
    return JSON.stringify(style);
}

