'use strict';

var ShelfPack = require('shelf-pack');
var util = require('../util/util');

var SIZE_GROWTH_RATE = 4;
var DEFAULT_SIZE = 128;
// must be "DEFAULT_SIZE * SIZE_GROWTH_RATE ^ n" for some integer n
var MAX_SIZE = 2048;

module.exports = GlyphAtlas;
function GlyphAtlas() {
    this.width = DEFAULT_SIZE;
    this.height = DEFAULT_SIZE;

    this.bin = new ShelfPack(this.width, this.height);
    this.index = {};
    this.ids = {};
    this.data = new Uint8Array(this.width * this.height);
}

GlyphAtlas.prototype.getGlyphs = function() {
    var glyphs = {},
        split,
        name,
        id;

    for (var key in this.ids) {
        split = key.split('#');
        name = split[0];
        id = split[1];

        if (!glyphs[name]) glyphs[name] = [];
        glyphs[name].push(id);
    }

    return glyphs;
};

GlyphAtlas.prototype.getRects = function() {
    var rects = {},
        split,
        name,
        id;

    for (var key in this.ids) {
        split = key.split('#');
        name = split[0];
        id = split[1];

        if (!rects[name]) rects[name] = {};
        rects[name][id] = this.index[key];
    }

    return rects;
};


GlyphAtlas.prototype.addGlyph = function(id, name, glyph, buffer) {
    if (!glyph) return null;

    var key = name + "#" + glyph.id;

    // The glyph is already in this texture.
    if (this.index[key]) {
        if (this.ids[key].indexOf(id) < 0) {
            this.ids[key].push(id);
        }
        return this.index[key];
    }

    // The glyph bitmap has zero width.
    if (!glyph.bitmap) {
        return null;
    }

    var bufferedWidth = glyph.width + buffer * 2;
    var bufferedHeight = glyph.height + buffer * 2;

    // Add a 1px border around every image.
    var padding = 1;
    var packWidth = bufferedWidth + 2 * padding;
    var packHeight = bufferedHeight + 2 * padding;

    // Increase to next number divisible by 4, but at least 1.
    // This is so we can scale down the texture coordinates and pack them
    // into fewer bytes.
    packWidth += (4 - packWidth % 4);
    packHeight += (4 - packHeight % 4);

    var rect = this.bin.packOne(packWidth, packHeight);
    if (!rect) {
        this.resize();
        rect = this.bin.packOne(packWidth, packHeight);
    }
    if (!rect) {
        util.warnOnce('glyph bitmap overflow');
        return null;
    }

    this.index[key] = rect;
    this.ids[key] = [id];

    var target = this.data;
    var source = glyph.bitmap;
    for (var y = 0; y < bufferedHeight; y++) {
        var y1 = this.width * (rect.y + y + padding) + rect.x + padding;
        var y2 = bufferedWidth * y;
        for (var x = 0; x < bufferedWidth; x++) {
            target[y1 + x] = source[y2 + x];
        }
    }

    this.dirty = true;

    return rect;
};

GlyphAtlas.prototype.resize = function() {
    var prevWidth = this.width;
    var prevHeight = this.height;

    if (prevWidth >= MAX_SIZE || prevHeight >= MAX_SIZE) return;

    if (this.texture) {
        if (this.gl) {
            this.gl.deleteTexture(this.texture);
        }
        this.texture = null;
    }

    this.width *= SIZE_GROWTH_RATE;
    this.height *= SIZE_GROWTH_RATE;
    this.bin.resize(this.width, this.height);

    var buf = new ArrayBuffer(this.width * this.height);
    for (var i = 0; i < prevHeight; i++) {
        var src = new Uint8Array(this.data.buffer, prevHeight * i, prevWidth);
        var dst = new Uint8Array(buf, prevHeight * i * SIZE_GROWTH_RATE, prevWidth);
        dst.set(src);
    }
    this.data = new Uint8Array(buf);
};

GlyphAtlas.prototype.bind = function(gl) {
    this.gl = gl;
    if (!this.texture) {
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, this.width, this.height, 0, gl.ALPHA, gl.UNSIGNED_BYTE, null);

    } else {
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
    }
};

GlyphAtlas.prototype.updateTexture = function(gl) {
    this.bind(gl);
    if (this.dirty) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.ALPHA, gl.UNSIGNED_BYTE, this.data);
        this.dirty = false;
    }
};
