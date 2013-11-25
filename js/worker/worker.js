'use strict';

var Actor = require('../util/actor.js');
module.exports = new Actor(self, self);


var WorkerTile = require('./workertile.js');

if (typeof alert === 'undefined') {
    var alert = function() {
        postMessage({ type: 'alert message', data: [].slice.call(arguments) });
    };
}


// Builds a function body from the JSON specification. Allows specifying other compare operations.
var comparators = {
    '==': function(bucket) {
        if (!('field' in bucket)) return;
        var value = bucket.value, field = bucket.field;
        return 'return ' + (Array.isArray(value) ? value : [value]).map(function(value) {
            return 'feature[' + JSON.stringify(field) + '] == ' + JSON.stringify(value);
        }).join(' || ') + ';'
    }
};


/*
 * Updates the style to use for this map.
 *
 * @param {Style} data
 */
self['set buckets'] = function(data) {
    var buckets = WorkerTile.buckets = data;
    for (var name in buckets) {
        var bucket = buckets[name];
        var compare = bucket.compare || '==';
        if (compare in comparators) {
            var code = comparators[compare](bucket)
            if (code) {
                bucket.fn = new Function('feature', code);
            }
        }
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
    new WorkerTile(params.url, params.id, params.zoom, callback);
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

self['list layers'] = function(id, callback) {
    if (WorkerTile.loaded[id]) {
        callback(null, WorkerTile.loaded[id].stats());
    } else {
        callback(null, {});
    }
};
