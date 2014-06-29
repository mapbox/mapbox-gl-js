'use strict';

var Actor = require('../util/actor.js');
var bucketFilter = require('../style/bucket-filter.js');

module.exports = new Actor(self, self);

var WorkerTile = require('./workertile.js');
var parseGeoJSON = require('./parsegeojson');

if (typeof self.alert === 'undefined') {
    self.alert = function() {
        self.postMessage({ type: 'alert message', data: [].slice.call(arguments) });
    };
}

// Updates the style to use for this map.
self['set buckets'] = function(data) {
    var buckets = WorkerTile.buckets = data;
    for (var i = 0; i < buckets.length; i++) {
        var bucket = buckets[i];
        bucket.compare = bucketFilter(bucket.filter, ['$type']);
    }
};

/*
 * Load and parse a tile at `url`, and call `callback` with
 * (err, response)
 *
 * @param {string} url
 * @param {function} callback
 */
self['load tile'] = function(params, callback) {
    new WorkerTile(params.url, undefined, params.id, params.zoom, params.tileSize, params.glyphs, params.source, callback);
};

/*
 * Abort the request keyed under `url`
 *
 * @param {string} url
 */
self['abort tile'] = function(id) {
    WorkerTile.cancel(id);
};

self['remove tile'] = function(id, source) {
    if (WorkerTile.loaded[source] && WorkerTile.loaded[source][id]) {
        delete WorkerTile.loaded[source][id];
    }
};

self['parse geojson'] = function(params) {
    parseGeoJSON(params);
};

self['query features'] = function(params, callback) {
    var tile = WorkerTile.loaded[params.source] && WorkerTile.loaded[params.source][params.id];
    if (tile) {
        tile.featureTree.query(params, callback);
    } else {
        callback(null, []);
    }
};
