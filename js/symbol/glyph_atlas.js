'use strict';

var ShelfPack = require('shelf-pack');
var util = require('../util/util');

var SIZE_GROWTH_RATE = 2;
var DEFAULT_SIZE = 128;
var MAX_SIZE = 2048;

module.exports = GlyphAtlas;


function GlyphAtlas() {
    this.width = DEFAULT_SIZE;
    this.height = DEFAULT_SIZE;
    this.binpacker = new ShelfPack(this.width, this.height);

    this.tilebins = {};
    this.gl = null;
    this.texture = null;

    this.data = new Uint8Array(this.width * this.height);
}


GlyphAtlas.prototype.addGlyph = function(glyph, uid, buffer) {
    if (!glyph) return null;

    if (!this.tilebins[uid]) {
        this.tilebins[uid] = [];
    }

    // The glyph is already in this texture.
    var bin = this.binpacker.getBin(glyph.id);
    if (bin) {
        this.tilebins[uid].push(bin);
        this.binpacker.ref(bin);
        return bin;
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

    bin = this.binpacker.packOne(packWidth, packHeight, glyph.id);
    if (!bin) {
        this.resize();
        bin = this.binpacker.packOne(packWidth, packHeight, glyph.id);
    }
    if (!bin) {
        util.warnOnce('GlyphAtlas out of space');
        return null;
    }

    this.tilebins[uid].push(bin);


    var target = this.data;
    var source = glyph.bitmap;
    for (var y = 0; y < bin.maxh; y++) {
        var y1 = this.width * (bin.y + y + padding) + bin.x + padding;
        var y2 = bufferedWidth * y;
        for (var x = 0; x < bin.maxw; x++) {
            target[y1 + x] = (y < bufferedHeight && x < bufferedWidth) ? source[y2 + x] : 0;
        }
    }

    this.dirty = true;
    return bin;
};


GlyphAtlas.prototype.removeTileGlyphs = function(uid) {
    var bins = this.tilebins[uid];
    if (!bins) return;

    for (var i = 0; i < bins.length; i++) {
        this.binpacker.unref(bins[i]);
    }
    delete this.tilebins[uid];
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
    this.binpacker.resize(this.width, this.height);

    var buf = new ArrayBuffer(this.width * this.height);
    for (var i = 0; i < prevHeight; i++) {
        var src = new Uint8Array(this.data.buffer, prevHeight * i, prevWidth);
        var dst = new Uint8Array(buf, prevHeight * i * SIZE_GROWTH_RATE, prevWidth);
        dst.set(src);
    }

    this.data = new Uint8Array(buf);
    this.ditry = true;
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
