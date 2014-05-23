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

module.exports = GlyphTile;
function GlyphTile(url, callback) {
    var tile = this;
    this.url = url;
    var id = this.id = -1;

    GlyphTile.loading[id] = loadBuffer(url, function(err, data) {
        delete GlyphTile.loading[id];
        if (err) {
            callback(err);
        } else {
            GlyphTile.loaded[id] = tile;
            tile.data = new VectorTile(new Protobuf(new Uint8Array(data)));
            tile.parse(tile.data, callback);
        }
    });
}

GlyphTile.cancel = function(id) {
    if (GlyphTile.loading[id]) {
        GlyphTile.loading[id].abort();
        delete GlyphTile.loading[id];
    }
};

// Stores tiles that are currently loading.
GlyphTile.loading = {};

// Stores tiles that are currently loaded.
GlyphTile.loaded = {};

/*
 * Given tile data, parse raw vertices and data, create a vector
 * tile and parse it into ready-to-render vertices.
 *
 * @param {object} data
 * @param {function} respond
 */
GlyphTile.prototype.parse = function(tile, callback) {
    var self = this;

    actor.send('add glyph range', {
        id: self.id,
        stacks: tile.stacks
    }, callback);
};
