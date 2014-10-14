'use strict';

var Actor = require('../util/actor');
var bucketFilter = require('../style/bucket_filter');
var WorkerTile = require('./worker_tile');
var tileGeoJSON = require('./tile_geojson');
var Wrapper = require('./geojson_wrapper');
var util = require('../util/util');
var queue = require('queue-async');
var ajax = require('../util/ajax');

module.exports = Worker;

function Worker(self) {
    this.self = self;
    this.actor = new Actor(self, this);
}

util.extend(Worker.prototype, {
    alert: function() {
        this.self.postMessage({
            type: 'alert message',
            data: [].slice.call(arguments)
        });
    },

    // Updates the style to use for this map.
    'set buckets': function(data) {
        var buckets = WorkerTile.buckets = data;
        for (var i = 0; i < buckets.length; i++) {
            var bucket = buckets[i];
            bucket.compare = bucketFilter(bucket.filter);
        }
    },

    'set glyphs': function(data) {
        WorkerTile.prototype.glyphs = data;
    },

    /*
     * Load and parse a tile at `url`, and call `callback` with
     * (err, response)
     *
     * @param {string} url
     * @param {function} callback
     */
    'load tile': function(params, callback) {
        if( (params.minZoom !== undefined && params.minZoom <= params.zoom) || 
            (params.maxZoom !== undefined && params.maxZoom >= params.zoom)) {
            new WorkerTile(params.url, undefined, params.id, params.zoom, params.maxZoom, params.tileSize, params.source, params.depth, this.actor, callback);
        }
    },

    /*
     * Abort the request keyed under `url`
     *
     * @param {string} url
     */
    'abort tile': function(params) {
        WorkerTile.cancel(params.id, params.source);
    },

    'remove tile': function(params) {
        var id = params.id;
        var source = params.source;
        if (WorkerTile.loaded[source] && WorkerTile.loaded[source][id]) {
            delete WorkerTile.loaded[source][id];
        }
    },

    'parse geojson': function(params, callback) {
        var data = params.data,
            zooms = params.zooms,
            len = zooms.length,
            maxZoom = zooms[len - 1],
            actor = this.actor,
            q = queue();

        function worker(id, tile, zoom, callback) {
            new WorkerTile(undefined, new Wrapper(tile), id, zoom, maxZoom, params.tileSize, params.source, 4, actor, function(err, data) {
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
        var tile = WorkerTile.loaded[params.source] && WorkerTile.loaded[params.source][params.id];
        if (tile) {
            tile.featureTree.query(params, callback);
        } else {
            callback(null, []);
        }
    }
});
