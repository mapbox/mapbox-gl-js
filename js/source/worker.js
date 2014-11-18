'use strict';

var Actor = require('../util/actor');
var featureFilter = require('feature-filter');
var WorkerTile = require('./worker_tile');
var tileGeoJSON = require('./tile_geojson');
var Wrapper = require('./geojson_wrapper');
var util = require('../util/util');
var queue = require('queue-async');
var ajax = require('../util/ajax');
var vt = require('vector-tile');
var Protobuf = require('pbf');

module.exports = Worker;

function Worker(self) {
    this.self = self;
    this.actor = new Actor(self, this);
    this.loading = {};
    this.loaded = {};
    this.buckets = [];
}

util.extend(Worker.prototype, {
    alert: function() {
        this.self.postMessage({
            type: 'alert message',
            data: [].slice.call(arguments)
        });
    },

    'set buckets': function(buckets) {
        this.buckets = buckets;
        for (var i = 0; i < this.buckets.length; i++) {
            var bucket = this.buckets[i];
            bucket.compare = featureFilter(bucket.filter);
        }
    },

    'load tile': function(params, callback) {
        var source = params.source,
            id = params.id;

        if (!this.loading[source])
            this.loading[source] = {};

        this.loading[source][id] = ajax.getArrayBuffer(params.url, (err, data) => {
            delete this.loading[source][id];

            if (err) return callback(err);

            var tile = new WorkerTile(
                params.id, params.zoom, params.maxZoom,
                params.tileSize, params.source, params.depth);

            tile.parse(new vt.VectorTile(new Protobuf(new Uint8Array(data))), this.buckets, this.actor, callback);

            this.loaded[source] = this.loaded[source] || {};
            this.loaded[source][id] = tile;
        });
    },

    'abort tile': function(params) {
        var source = this.loading[params.source];
        if (source && source[params.id]) {
            source[params.id].abort();
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

    'parse geojson': function(params, callback) {
        var data = params.data,
            zooms = params.zooms,
            len = zooms.length,
            maxZoom = zooms[len - 1],
            buckets = this.buckets,
            actor = this.actor,
            q = queue();

        function worker(id, geoJSON, zoom, callback) {
            var tile = new WorkerTile(id, zoom, maxZoom, params.tileSize, params.source, 4);
            tile.parse(new Wrapper(geoJSON), buckets, actor, function(err, data) {
                if (err) return callback(err);
                data.id = id;
                callback(null, data);
            });
        }

        function tileData(err, data) {
            if (err) throw err;
            for (var i = 0; i < len; i++) {
                var zoom = zooms[i];
                var tiles = tileGeoJSON(data, zoom);
                for (var id in tiles) {
                    q.defer(worker, id, tiles[id], zoom);
                }
            }
            q.awaitAll(callback);
        }

        if (typeof data === 'string') ajax.getJSON(data, tileData);
        else tileData(null, data);
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
