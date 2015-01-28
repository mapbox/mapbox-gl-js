'use strict';

var BinPack = require('./bin_pack');

module.exports = GlyphAtlas;
function GlyphAtlas(width, height) {
    this.width = width;
    this.height = height;

    this.bin = new BinPack(width, height);
    this.index = {};
    this.ids = {};
    this.data = new Uint8Array(width * height);
}

GlyphAtlas.prototype = {
    get debug() {
        return 'canvas' in this;
    },
    set debug(value) {
        if (value && !this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.width = this.width;
            this.canvas.height = this.height;
            document.body.appendChild(this.canvas);
            this.ctx = this.canvas.getContext('2d');
        } else if (!value && this.canvas) {
            this.canvas.parentNode.removeChild(this.canvas);
            delete this.ctx;
            delete this.canvas;
        }
    }
};

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

GlyphAtlas.prototype.removeGlyphs = function(id) {
    for (var key in this.ids) {

        var ids = this.ids[key];

        var pos = ids.indexOf(id);
        if (pos >= 0) ids.splice(pos, 1);
        this.ids[key] = ids;

        if (!ids.length) {
            var rect = this.index[key];

            var target = this.data;
            for (var y = 0; y < rect.h; y++) {
                var y1 = this.width * (rect.y + y) + rect.x;
                for (var x = 0; x < rect.w; x++) {
                    target[y1 + x] = 0;
                }
            }

            this.dirty = true;

            this.bin.release(rect);

            delete this.index[key];
            delete this.ids[key];
        }
    }


    this.updateTexture(this.gl);
};

GlyphAtlas.prototype.addGlyph = function(id, name, glyph, buffer) {
    if (!glyph) {
        // console.warn('missing glyph', code, String.fromCharCode(code));
        return null;
    }
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
    var packWidth = bufferedWidth;
    var packHeight = bufferedHeight;

    // Increase to next number divisible by 4, but at least 1.
    // This is so we can scale down the texture coordinates and pack them
    // into 2 bytes rather than 4 bytes.
    packWidth += (4 - packWidth % 4);
    packHeight += (4 - packHeight % 4);

    var rect = this.bin.allocate(packWidth, packHeight);
    if (rect.x < 0) {
        console.warn('glyph bitmap overflow');
        return { glyph: glyph, rect: null };
    }

    // Add left and top glyph offsets to rect.
    rect.l = glyph.left;
    rect.t = glyph.top;

    this.index[key] = rect;
    this.ids[key] = [id];

    var target = this.data;
    var source = glyph.bitmap;
    for (var y = 0; y < bufferedHeight; y++) {
        var y1 = this.width * (rect.y + y) + rect.x;
        var y2 = bufferedWidth * y;
        for (var x = 0; x < bufferedWidth; x++) {
            target[y1 + x] = source[y2 + x];
        }
    }

    this.dirty = true;

    return rect;
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

        // DEBUG
        if (this.ctx) {
            var data = this.ctx.getImageData(0, 0, this.width, this.height);
            for (var i = 0, j = 0; i < this.data.length; i++, j += 4) {
                data.data[j] = this.data[i];
                data.data[j + 1] = this.data[i];
                data.data[j + 2] = this.data[i];
                data.data[j + 3] = 255;
            }
            this.ctx.putImageData(data, 0, 0);

            this.ctx.strokeStyle = 'red';
            for (var k = 0; k < this.bin.free.length; k++) {
                var free = this.bin.free[k];
                this.ctx.strokeRect(free.x, free.y, free.w, free.h);
            }
        }
        // END DEBUG

        this.dirty = false;
    }
};
