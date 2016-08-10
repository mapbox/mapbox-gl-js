'use strict';

var ShelfPack = require('shelf-pack');
var util = require('../util/util');

module.exports = GlyphAtlas;


function GlyphAtlas(width, height) {
    this.width = width;
    this.height = height;

    this.sprite = new ShelfPack(width, height);
    this.data = new Uint8Array(width * height);
    this.tilebins = {};
}


GlyphAtlas.prototype.addGlyph = function(glyph, uid, buffer) {
    if (!glyph) return null;

    if (!this.tilebins[uid]) {
        this.tilebins[uid] = [];
    }

    // The glyph is already in this texture.
    var bin = this.sprite.getBin(glyph.id);
    if (bin) {
        this.tilebins[uid].push(bin);
        this.sprite.ref(bin);
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
    // into 2 bytes rather than 4 bytes.
    packWidth += (4 - packWidth % 4);
    packHeight += (4 - packHeight % 4);

    bin = this.sprite.packOne(packWidth, packHeight, glyph.id);
    if (!bin) {
        this.resize();
        bin = this.sprite.packOne(packWidth, packHeight, glyph.id);
    }
    if (!bin) {
        util.warnOnce('glyph bitmap overflow');
        return null;
    }

    this.tilebins[uid].push(bin);


    var target = this.data;
    var source = glyph.bitmap;
    for (var y = 0; y < bufferedHeight; y++) {
        var y1 = this.width * (bin.y + y + padding) + bin.x + padding;
        var y2 = bufferedWidth * y;
        for (var x = 0; x < bufferedWidth; x++) {
            target[y1 + x] = source[y2 + x];
        }
    }

    this.dirty = true;

    return bin;
};


GlyphAtlas.prototype.removeTileGlyphs = function(uid) {
    var bins = this.tilebins[uid];
    if (!bins) return;

    for (var i = 0; i < bins.length; i++) {
        this.sprite.unref(bins[i]);
    }
    delete this.tilebins[uid];
};


GlyphAtlas.prototype.resize = function() {
    var origw = this.width,
        origh = this.height;

    // For now, don't grow the atlas beyond 1024x1024 because of how
    // texture coords pack into unsigned byte in symbol bucket.
    if (origw > 512 || origh > 512) return;

    if (this.texture) {
        if (this.gl) {
            this.gl.deleteTexture(this.texture);
        }
        this.texture = null;
    }

    this.width *= 2;
    this.height *= 2;
    this.sprite.resize(this.width, this.height);

    var buf = new ArrayBuffer(this.width * this.height),
        src, dst;
    for (var i = 0; i < origh; i++) {
        src = new Uint8Array(this.data.buffer, origh * i, origw);
        dst = new Uint8Array(buf, origh * i * 2, origw);
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
