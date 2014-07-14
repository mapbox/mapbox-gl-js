'use strict';

var Protobuf = require('pbf');
var Glyphs = require('../format/glyphs.js');
var getArrayBuffer = require('../util/ajax.js').getArrayBuffer;

module.exports = GlyphTile;
function GlyphTile(url, actor, callback) {
    var tile = this;
    var id = this.id = -1;

    GlyphTile.loading[id] = getArrayBuffer(url, function(err, data) {
        delete GlyphTile.loading[id];
        if (err) {
            callback(err);
        } else {
            GlyphTile.loaded[id] = tile;
            tile.data = new Glyphs(new Protobuf(new Uint8Array(data)));
            tile.parse(tile.data, actor, callback);
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
GlyphTile.prototype.parse = function(tile, actor, callback) {
    var self = this;

    actor.send('add glyph range', {
        id: self.id,
        stacks: tile.stacks
    }, callback);
};
