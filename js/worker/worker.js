'use strict';

var Actor = require('../util/actor.js'),
    bucketFilter = require('../style/bucket-filter.js');

module.exports = new Actor(self, self);


var WorkerTile = require('./workertile.js');
var GlyphTile = require('./glyphtile.js');

if (typeof self.alert === 'undefined') {
    self.alert = function() {
        self.postMessage({ type: 'alert message', data: [].slice.call(arguments) });
    };
}

// Updates the style to use for this map.
self['set buckets'] = function(data) {
    var buckets = WorkerTile.buckets = data;

    for (var id in buckets) {
        buckets[id].fn = bucketFilter(buckets[id], ['source', 'layer', 'feature_type']);
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
    new WorkerTile(params.url, params.id, params.zoom, params.tileSize, callback);
};

/*
 * Load and parse a glyph tile at `url`, and call `callback` with
 * (err, response)
 *
 * @param {string} url
 * @param {int} start
 * @param {int} end
 * @param {function} callback
 */
self['load glyphs'] = function(params, callback) {
    new GlyphTile(params.url, params.start, params.end, callback);
};

/*
 * Abort the request keyed under `url`
 *
 * @param {string} url
 */
self['abort tile'] = function(id) {
    WorkerTile.cancel(id);
};

self['remove tile'] = function(id) {
    if (WorkerTile.loaded[id]) {
        delete WorkerTile.loaded[id];
    }
};

self['query features'] = function(params, callback) {
    var tile = WorkerTile.loaded[params.id];
    if (tile) {
        tile.featureTree.query(params, callback);
    } else {
        callback(null, []);
    }
};
