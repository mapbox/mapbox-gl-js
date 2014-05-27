'use strict';

module.exports = Glyphs;
function Glyphs(buffer, end) {
    // Public
    this.stacks = {};
    // Private
    this._buffer = buffer;

    var val, tag;
    if (typeof end === 'undefined') end = buffer.length;
    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;
        if (tag == 1) {
            var fontstack = this.readFontstack();
            this.stacks[fontstack.name] = fontstack;
        } else {
            // console.warn('skipping tile tag ' + tag);
            buffer.skip(val);
        }
    }
}

Glyphs.prototype.readFontstack = function() {
    var buffer = this._buffer;
    var fontstack = { glyphs: {} };

    var bytes = buffer.readVarint();
    var val, tag;
    var end = buffer.pos + bytes;
    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;

        if (tag == 1) {
            fontstack.name = buffer.readString();
        } else if (tag == 2) {
            var range = buffer.readString();
            fontstack.range = range;
        } else if (tag == 3) {
            var glyph = this.readGlyph();
            fontstack.glyphs[glyph.id] = glyph;
        } else {
            buffer.skip(val);
        }
    }

    return fontstack;
};

Glyphs.prototype.readGlyph = function() {
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
