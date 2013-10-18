function GlyphAtlas(width, height) {
    var atlas = this;
    this.width = width;
    this.height = height;

    this.bin = new BinPack(width, height);
    this.index = {};

    // DEBUG
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    // END DEBUG
}

GlyphAtlas.prototype.addGlyph = function(name, glyph, buffer) {
    if (!glyph) {
        // console.warn('missing glyph', code, String.fromCharCode(code));
        return null;
    }
    var key = name + "#" + glyph.id;

    // The glyph is already in this texture.
    if (this.index[key]) {
        return this.index[key];
    }

    // The glyph bitmap has zero width.
    if (!glyph.bitmap) {
        return null;
    }

    var buffered_width = glyph.width + buffer * 2;
    var buffered_height = glyph.height + buffer * 2;

    // Add a 1px border around every image.
    var pack_width = buffered_width;
    var pack_height = buffered_height;

    // Increase to next number divisible by 4, but at least 1.
    // This is so we can scale down the texture coordinates and pack them
    // into 2 bytes rather than 4 bytes.
    pack_width += (4 - pack_width % 4);
    pack_height += (4 - pack_height % 4);

    var rect = this.bin.allocate(pack_width, pack_height);
    if (rect.x < 0) {
        console.warn('glyph bitmap overflow');
        return { glyph: glyph, rect: null };
    }

    this.index[key] = rect;

    // DEBUG
    var data = this.ctx.getImageData(rect.x, rect.y, buffered_width, buffered_height);
    var source = glyph.bitmap;
    var target = data.data;
    var length = source.length;
    for (var i = 0, j = 0; i < length; i++, j += 4) {
        target[j + 0] = source[i];
        target[j + 1] = source[i];
        target[j + 2] = source[i];
        target[j + 3] = 255;
    }
    this.ctx.putImageData(data, rect.x, rect.y);
    // END DEBUG

    var gl = this.gl;
    this.bind(gl);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, rect.x, rect.y, gl.LUMINANCE, gl.UNSIGNED_BYTE,
        this.ctx.getImageData(rect.x, rect.y, pack_width, pack_height));

    this.dirty = true;

    return rect;
};

GlyphAtlas.prototype.bind = function(gl) {
    this.gl = gl;
    if (!this.texture) {
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, this.canvas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    } else {
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
    }
};

GlyphAtlas.prototype.updateTexture = function(gl) {
    this.bind(gl);
    if (this.dirty) {
        this.dirty = false;
    }
};
