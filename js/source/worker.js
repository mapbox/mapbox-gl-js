'use strict';

var Actor = require('../util/actor');
var WorkerTile = require('./worker_tile');
var util = require('../util/util');
var ajax = require('../util/ajax');
var vt = require('vector-tile');
var Protobuf = require('pbf');
var TileCoord = require('./tile_coord');

var geojsonvt = require('geojson-vt');
var GeoJSONWrapper = require('./geojson_wrapper');

module.exports = Worker;

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

    'load tile': function(params, callback) {
        var source = params.source,
            id = params.id;

        if (!this.loading[source])
            this.loading[source] = {};

        var xhr = ajax.getArrayBuffer(params.url, done.bind(this));

        var tile = this.loading[source][id] = new WorkerTile(
            params.id, params.zoom, params.maxZoom,
            params.tileSize, params.source, params.depth, params.angle, xhr);

        function done(err, data) {
            delete this.loading[source][id];

            if (err) return callback(err);

            tile.data = new vt.VectorTile(new Protobuf(new Uint8Array(data)));
            tile.parse(tile.data, this.layers, this.actor, callback);

            this.loaded[source] = this.loaded[source] || {};
            this.loaded[source][id] = tile;
        }
    },

    'reload tile': function(params, callback) {
        var tile = this.loaded[params.source][params.id];
        tile.parse(tile.data, this.layers, this.actor, callback);
    },

    'abort tile': function(params) {
        var source = this.loading[params.source];
        if (source && source[params.id]) {
            source[params.id].xhr.abort();
            delete source[params.id];
        }
    },

    'remove tile': function(params) {
        var source = params.source,
            id = params.id;
        if (this.loaded[source] && this.loaded[source][id]) {
            delete this.loaded[source][id];
        }
    },

    'redo placement': function(params, callback) {
        var source = params.source,
            id = params.id;


        if (this.loaded[source] && this.loaded[source][id]) {
            var tile = this.loaded[source][id];
            var result = tile.redoPlacement(params.angle);

            if (result.result) {
                callback(null, result.result, result.transferables);
            }

        } else if (this.loading[source] && this.loading[source][id]) {
            this.loading[source][id].angle = params.angle;
        }
    },

    'parse geojson': function(params, callback) {
        var indexData = function(err, data) {
            if (err) return callback(err);
            this.geoJSONIndexes[params.source] = geojsonvt(data, {baseZoom: params.maxZoom});
            callback(null);
        }.bind(this);

        // TODO accept params.url for urls instead
        if (typeof params.data === 'string') ajax.getJSON(params.data, indexData);
        else indexData(null, params.data);
    },

    'load geojson tile': function(params, callback) {
        var source = params.source,
            tileId = params.tileId,
            id = params.id,
            coord = TileCoord.fromID(tileId);

        // console.time('tile ' + coord.z + ' ' + coord.x + ' ' + coord.y);

        var geoJSONTile = this.geoJSONIndexes[source].getTile(coord.z, coord.x, coord.y);

        // console.timeEnd('tile ' + coord.z + ' ' + coord.x + ' ' + coord.y);

        // if (!geoJSONTile) console.log('not found', this.geoJSONIndexes[source], coord);

        if (!geoJSONTile) return callback(null, null); // nothing in the given tile

        var tile = new WorkerTile(id, params.zoom, params.maxZoom, params.tileSize, source, params.depth);
        tile.parse(new GeoJSONWrapper(geoJSONTile.features), this.layers, this.actor, callback);

        this.loaded[source] = this.loaded[source] || {};
        this.loaded[source][id] = tile;
    },

    'query features': function(params, callback) {
        var tile = this.loaded[params.source] && this.loaded[params.source][params.id];
        if (tile) {
            tile.featureTree.query(params, callback);
        } else {
            callback(null, []);
        }
    }
});
