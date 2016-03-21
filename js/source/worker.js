'use strict';

var Actor = require('../util/actor');
var WorkerTile = require('./worker_tile');
var util = require('../util/util');
var ajax = require('../util/ajax');
var vt = require('vector-tile');
var Protobuf = require('pbf');
var supercluster = require('supercluster');

var geojsonvt = require('geojson-vt');
var rewind = require('geojson-rewind');
var GeoJSONWrapper = require('./geojson_wrapper');

module.exports = function(self) {
    return new Worker(self);
};

function Worker(self) {
    this.self = self;
    this.actor = new Actor(self, this);
    this.loading = {};

    this.loaded = {};
    this.layers = [];
    this.geoJSONIndexes = {};
}

util.extend(Worker.prototype, {
    'set layers': function(layers) {
        this.layers = layers;
    },

    'update layers': function(layers) {
        var layersById = {};
        var i;
        for (i = 0; i < layers.length; i++) {
            layersById[layers[i].id] = layers[i];
        }
        for (i = 0; i < this.layers.length; i++) {
            this.layers[i] = layersById[this.layers[i].id] || this.layers[i];
        }
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
            tile.parse(tile.data, this.layers, this.actor, callback);

            this.loaded[source] = this.loaded[source] || {};
            this.loaded[source][uid] = tile;
        }
    },

    'reload tile': function(params, callback) {
        var loaded = this.loaded[params.source],
            uid = params.uid;
        if (loaded && loaded[uid]) {
            var tile = loaded[uid];
            tile.parse(tile.data, this.layers, this.actor, callback);
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
            var result = tile.redoPlacement(params.angle, params.pitch, params.collisionDebug);

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
            tile.parse(new GeoJSONWrapper(geoJSONTile.features), this.layers, this.actor, callback);
        } else {
            return callback(null, null); // nothing in the given tile
        }
    },

    'query features': function(params, callback) {
        var tile = this.loaded[params.source] && this.loaded[params.source][params.uid];
        if (tile) {
            tile.featureTree.query(params, callback);
        } else {
            callback(null, []);
        }
    }
});
