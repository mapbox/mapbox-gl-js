'use strict';

var VectorTileLayer = require('./vectortilelayer');

module.exports = VectorTile;
function VectorTile(buffer, end) {
    // Public
    this.layers = {};
    this.faces = {};
    this.stacks = {};

    // Private
    this._buffer = buffer;

    var val, tag;
    if (typeof end === 'undefined') end = buffer.length;
    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;
        if (tag == 3) {
            var layer = this.readLayer();
            if (layer.length) {
                this.layers[layer.name] = layer;
            }
        } else if (tag == 4) {
            var face = this.readFace();
            this.faces[face.family + ' ' + face.style] = face;
        } else if (tag == 5) {
            var fontstack = this.readFontstack();
            this.stacks[fontstack.name] = fontstack;
        } else {
            // console.warn('skipping tile tag ' + tag);
            buffer.skip(val);
        }
    }
}

VectorTile.prototype.readLayer = function() {
    var buffer = this._buffer;

    var bytes = buffer.readVarint();
    var end = buffer.pos + bytes;
    var layer = new VectorTileLayer(buffer, end);
    buffer.pos = end;
    return layer;
};

VectorTile.prototype.readFontstack = function() {
    var buffer = this._buffer;
    var fontstack = { faces: [] };

    var bytes = buffer.readVarint();
    var val, tag;
    var end = buffer.pos + bytes;
    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;

        if (tag == 1) {
            fontstack.name = buffer.readString();
        } else if (tag == 2) {
            var face = buffer.readString();
            fontstack.faces.push(face);
        } else {
            buffer.skip(val);
        }
    }

    return fontstack;
};

VectorTile.prototype.readFace = function() {
    var buffer = this._buffer;
    var face = { glyphs: {} };

    var bytes = buffer.readVarint();
    var val, tag;
    var end = buffer.pos + bytes;
    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;

        if (tag == 1) {
            face.family = buffer.readString();
        } else if (tag == 2) {
            face.style = buffer.readString();
        } else if (tag == 5) {
            var glyph = this.readGlyph();
            face.glyphs[glyph.id] = glyph;
        } else {
            buffer.skip(val);
        }
    }

    return face;
};


VectorTile.prototype.readGlyph = function() {
    var buffer = this._buffer;
    var glyph = {};

    var bytes = buffer.readVarint();
    var val, tag;
    var end = buffer.pos + bytes;
    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;

        if (tag == 1) {
            glyph.id = buffer.readVarint();
        } else if (tag == 2) {
            glyph.bitmap = buffer.readBuffer();
        } else if (tag == 3) {
            glyph.width = buffer.readVarint();
        } else if (tag == 4) {
            glyph.height = buffer.readVarint();
        } else if (tag == 5) {
            glyph.left = buffer.readSVarint();
        } else if (tag == 6) {
            glyph.top = buffer.readSVarint();
        } else if (tag == 7) {
            glyph.advance = buffer.readVarint();
        } else {
            buffer.skip(val);
        }
    }

    return glyph;
};
