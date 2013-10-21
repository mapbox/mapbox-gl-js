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

    this.data = new Uint8Array(width * height);
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
        // console.warn('glyph bitmap overflow');
        return { glyph: glyph, rect: null };
    }

    this.index[key] = rect;

    var target = this.data;
    var source = glyph.bitmap;
    for (var y = 0; y < buffered_height; y++) {
        var y1 = this.width * (rect.y + y) + rect.x;
        var y2 = buffered_width * y;
        for (var x = 0; x < buffered_width; x++) {
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

    } else {
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
    }
};

GlyphAtlas.prototype.updateTexture = function(gl) {
    this.bind(gl);
    if (this.dirty) {

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, this.width, this.height, 0, gl.ALPHA, gl.UNSIGNED_BYTE, this.data);

        // DEBUG
        var data = this.ctx.getImageData(0, 0, this.width, this.height);
        for (var i = 0, j = 0; i < this.data.length; i++, j += 4) {
            data.data[j] = this.data[i];
            data.data[j+1] = this.data[i];
            data.data[j+2] = this.data[i];
            data.data[j+3] = 255;
        }
        this.ctx.putImageData(data, 0, 0);
        // END DEBUG

        this.dirty = false;
    }
};
