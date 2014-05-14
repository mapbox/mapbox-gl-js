'use strict';

var Protobuf = require('pbf');
var VectorTile = require('../format/vectortile.js');

// if (typeof self.console === 'undefined') {
//     self.console = require('./console.js');
// }

var actor = require('./worker.js');

/*
 * Request a resources as an arraybuffer
 *
 * @param {string} url
 * @param {function} callback
 */
function loadBuffer(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";
    xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
            callback(null, xhr.response);
        } else {
            callback(xhr.statusText);
        }
    };
    xhr.send();
    return xhr;
}

module.exports = WorkerTile;
function WorkerTile(url, id, zoom, tileSize, callback) {
    var tile = this;
    this.url = url;
    this.id = id;
    this.zoom = zoom;
    this.tileSize = tileSize;

    WorkerTile.loading[id] = loadBuffer(url, function(err, data) {
        delete WorkerTile.loading[id];
        if (err) {
            callback(err);
        } else {
            WorkerTile.loaded[id] = tile;
            tile.data = new VectorTile(new Protobuf(new Uint8Array(data)));
            tile.parse(tile.data, callback);
        }
    });
}

WorkerTile.cancel = function(id) {
    if (WorkerTile.loading[id]) {
        WorkerTile.loading[id].abort();
        delete WorkerTile.loading[id];
    }
};

// Stores tiles that are currently loading.
WorkerTile.loading = {};

// Stores tiles that are currently loaded.
WorkerTile.loaded = {};

/*
 * Given tile data, parse raw vertices and data, create a vector
 * tile and parse it into ready-to-render vertices.
 *
 * @param {object} data
 * @param {function} respond
 */
WorkerTile.prototype.parse = function(tile, callback) {
    var self = this;

    actor.send('add glyphs', {
        id: self.id,
        faces: tile.faces
    }, function(err, rects) {
        if (err) {
            // Stop processing this tile altogether if we failed to 
            // add the glyphs.
            return;
        }

        callback(rects);
    });
};
