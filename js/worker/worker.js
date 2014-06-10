'use strict';

var Actor = require('../util/actor.js'),
    bucketFilter = require('../style/bucket-filter.js'),
    util = require('../util/util.js');


module.exports = new Actor(self, self);


var WorkerTile = require('./workertile.js');

if (typeof self.alert === 'undefined') {
    self.alert = function() {
        self.postMessage({ type: 'alert message', data: [].slice.call(arguments) });
    };
}

// Updates the style to use for this map.
self['set buckets'] = function(stylesheet) {
    WorkerTile.stylesheet = stylesheet;

    util.forEachLayer(stylesheet.layers, function(layer) {
        if (!layer.copy && layer.filter) {
            layer.compare = bucketFilter(layer.filter, ['source', 'layer', 'feature_type']);
        }
    });
};

/*
 * Load and parse a tile at `url`, and call `callback` with
 * (err, response)
 *
 * @param {string} url
 * @param {function} callback
 */
self['load tile'] = function(params, callback) {
    new WorkerTile(params.url, params.id, params.zoom, params.tileSize, params.template, params.glyphs, callback);
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
