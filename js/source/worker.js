'use strict';

var Actor = require('../util/actor');
var WorkerTile = require('./worker_tile');
var StyleLayer = require('../style/style_layer');
var util = require('../util/util');
var ajax = require('../util/ajax');
var vt = require('vector-tile');
var Protobuf = require('pbf');
var supercluster = require('supercluster');

var geojsonvt = require('geojson-vt');
var rewind = require('geojson-rewind');
var GeoJSONWrapper = require('./geojson_wrapper');
var vtpbf = require('vt-pbf');

module.exports = function(self) {
    return new Worker(self);
};

function Worker(self) {
    this.self = self;
    this.actor = new Actor(self, this);
    this.loading = {};

    this.loaded = {};
    this.geoJSONIndexes = {};
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
        var source = params.source,
            uid = params.uid;

        if (!this.loading[source])
            this.loading[source] = {};


        var tile = this.loading[source][uid] = new WorkerTile(params);

        tile.xhr = ajax.getArrayBuffer(params.url, done.bind(this));

        function done(err, data) {
            delete this.loading[source][uid];

            if (err) return callback(err);

            tile.data = new vt.VectorTile(new Protobuf(new Uint8Array(data)));
            tile.parse(tile.data, this.layerFamilies, this.actor, data, callback);

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
        if (loading && loading[uid]) {
            loading[uid].xhr.abort();
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

    'parse geojson': function(params, callback) {
        var indexData = function(err, data) {
            rewind(data, true);
            if (err) return callback(err);
            if (typeof data != 'object') {
                return callback(new Error("Input data is not a valid GeoJSON object."));
            }
            try {
                this.geoJSONIndexes[params.source] = params.cluster ?
                    supercluster(params.superclusterOptions).load(data.features) :
                    geojsonvt(data, params.geojsonVtOptions);
            } catch (err) {
                return callback(err);
            }
            callback(null);
        }.bind(this);

        // Not, because of same origin issues, urls must either include an
        // explicit origin or absolute path.
        // ie: /foo/bar.json or http://example.com/bar.json
        // but not ../foo/bar.json
        if (params.url) {
            ajax.getJSON(params.url, indexData);
        } else if (typeof params.data === 'string') {
            indexData(null, JSON.parse(params.data));
        } else {
            return callback(new Error("Input data is not a valid GeoJSON object."));
        }
    },

    'load geojson tile': function(params, callback) {
        var source = params.source,
            coord = params.coord;

        if (!this.geoJSONIndexes[source]) return callback(null, null); // we couldn't load the file

        // console.time('tile ' + coord.z + ' ' + coord.x + ' ' + coord.y);

        var geoJSONTile = this.geoJSONIndexes[source].getTile(Math.min(coord.z, params.maxZoom), coord.x, coord.y);

        // console.timeEnd('tile ' + coord.z + ' ' + coord.x + ' ' + coord.y);

        // if (!geoJSONTile) console.log('not found', this.geoJSONIndexes[source], coord);

        var tile = geoJSONTile ? new WorkerTile(params) : undefined;

        this.loaded[source] = this.loaded[source] || {};
        this.loaded[source][params.uid] = tile;

        if (geoJSONTile) {
            var geojsonWrapper = new GeoJSONWrapper(geoJSONTile.features);
            geojsonWrapper.name = '_geojsonTileLayer';
            var rawTileData = vtpbf({ layers: { '_geojsonTileLayer': geojsonWrapper }}).buffer;
            tile.parse(geojsonWrapper, this.layerFamilies, this.actor, rawTileData, callback);
        } else {
            return callback(null, null); // nothing in the given tile
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
