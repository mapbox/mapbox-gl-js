'use strict';

var Actor = require('../util/actor.js');
module.exports = new Actor(self, self);


var WorkerTile = require('./workertile.js');

if (typeof self.alert === 'undefined') {
    self.alert = function() {
        self.postMessage({ type: 'alert message', data: [].slice.call(arguments) });
    };
}

function matchFn(bucket) {
    // jshint evil: true
    if (!('filter' in bucket)) return;

    var filters = [];
    for (var key in bucket.filter) {
        if (key === 'source' || key === 'layer' || key === 'feature_type') continue;
        var value = bucket.filter[key];
        if (Array.isArray(value)) {
            filters.push.apply(filters, value.map(function (v) {
                return {key: key, value: v};
            }));
        } else {
            filters.push({key: key, value: value});
        }
    }

    if (!filters.length) return;

    var fnCode = 'return ' + filters.map(function(f) {
        return 'f[' + JSON.stringify(f.key) + '] == ' + JSON.stringify(f.value);
    }).join(' || ') + ';';

    return new Function('f', fnCode);
}

// Updates the style to use for this map.
self['set buckets'] = function(data) {
    var buckets = WorkerTile.buckets = data;

    for (var id in buckets) {
        buckets[id].fn = matchFn(buckets[id]);
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
