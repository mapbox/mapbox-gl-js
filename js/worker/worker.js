'use strict';

var Actor = require('../util/actor.js'),
    bucketFilter = require('../style/bucket-filter.js');


module.exports = new Actor(self, self);


var Loader = require('../text/loader.js');
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

    /*
    var stacks = Object.keys(buckets).reduce(function(stacks, key) {
          var bucket = buckets[key],
              fontstack = bucket["text-font"];
        if (bucket.text && stacks.indexOf(fontstack) === -1) stacks.push(fontstack);
            return stacks;
    }, []);

    console.log(stacks);
    debugger;
    */

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

// Load rects from sdfs created in other tiles
self['set rects'] = function(params) {
    Loader.setRects(params);
};

// Update list of fonts
self['set fonts'] = function(fonts) {
    Loader.setFonts(fonts);
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
    new GlyphTile(params.url, callback);
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
