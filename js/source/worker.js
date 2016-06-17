'use strict';

var Actor = require('../util/actor');
var WorkerTile = require('./worker_tile');
var StyleLayer = require('../style/style_layer');
var util = require('../util/util');
var ajax = require('../util/ajax');
var vt = require('vector-tile');
var Protobuf = require('pbf');

var GeoJSONWorkerSource = require('./geojson_worker_source');

module.exports = function(self) {
    return new Worker(self);
};

function Worker(self) {
    this.self = self;
    this.actor = new Actor(self, this);

    this.loading = {};
    this.loaded = {};

    this.workerSources = {
        geojson: new GeoJSONWorkerSource()
    };

    self.registerWorkerSource = function (name, workerSource) {
        if (this.workerSources[name]) {
            throw new Error('Worker source with name "' + name + '" already registered.');
        }
        this.workerSources[name] = workerSource;
    }.bind(this);
}

util.extend(Worker.prototype, {
    // used by 'load tile' target
    loadVectorTile: function (params, callback) {
        var xhr = ajax.getArrayBuffer(params.url, done.bind(this));
        return function abort () { xhr.abort(); };
        function done(err, data) {
            if (err) { return callback(err); }
            var tile =  new vt.VectorTile(new Protobuf(new Uint8Array(data)));
            callback(err, { tile: tile, rawTileData: data });
        }
    },

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
        var source = params.source,
            uid = params.uid;

        if (!this.loading[source])
            this.loading[source] = {};

        var tile = this.loading[source][uid] = new WorkerTile(params);
        if (!params.type || !this.workerSources[params.type].loadTile) {
            tile.abort = this.loadVectorTile(params, done.bind(this));
        } else {
            tile.abort = this.workerSources[params.type].loadTile(params, done.bind(this));
        }

        function done(err, data) {
            delete this.loading[source][uid];

            if (err) return callback(err);
            if (!data) return callback(null, null);

            tile.data = data.tile;
            tile.parse(tile.data, this.layerFamilies, this.actor, data.rawTileData, callback);

            this.loaded[source] = this.loaded[source] || {};
            this.loaded[source][uid] = tile;
        }
    },

    'reload tile': function(params, callback) {
        var loaded = this.loaded[params.source],
            uid = params.uid;
        if (loaded && loaded[uid]) {
            var tile = loaded[uid];
            tile.parse(tile.data, this.layerFamilies, this.actor, params.rawTileData, callback);
        }
    },

    'abort tile': function(params) {
        var loading = this.loading[params.source],
            uid = params.uid;
        if (loading && loading[uid] && loading[uid].abort) {
            loading[uid].abort();
            delete loading[uid];
        }
    },

    'remove tile': function(params) {
        var loaded = this.loaded[params.source],
            uid = params.uid;
        if (loaded && loaded[uid]) {
            delete loaded[uid];
        }
    },

    'redo placement': function(params, callback) {
        var loaded = this.loaded[params.source],
            loading = this.loading[params.source],
            uid = params.uid;

        if (loaded && loaded[uid]) {
            var tile = loaded[uid];
            var result = tile.redoPlacement(params.angle, params.pitch, params.showCollisionBoxes);

            if (result.result) {
                callback(null, result.result, result.transferables);
            }

        } else if (loading && loading[uid]) {
            loading[uid].angle = params.angle;
        }
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

