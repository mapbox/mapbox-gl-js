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

GlyphAtlas.prototype.getGlyph = function(font, code) {
    var glyph = font.glyphs[code];
    if (!glyph) {
        // console.warn('missing glyph', code, String.fromCharCode(code));
        return null;
    }
    var name = font.family + "#" + font.style + "#" + code;

    // The glyph is already in this texture.
    if (this.index[name]) {
        return { glyph: glyph, rect: this.index[name] };
    }

    // The glyph bitmap has zero width.
    if (!glyph.bitmap) {
        return { glyph: glyph, rect: null };
    }

    var buffered_width = glyph.width + font.buffer * 2;
    var buffered_height = glyph.height + font.buffer * 2;

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

    this.index[name] = rect;
    // TODO: upload this to the texture image

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

    return { glyph: glyph, rect: rect };
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

GlyphAtlas.prototype.addText = function(faces, shaping, size, anchor, alignment, matrix, angle, buffer) {
    var dimensions = this.measureText(faces, shaping, size);

    // TODO: figure out correct ascender height.
    var origin = { x: 0, y: - size / 1.25 };

    // horizontal alignment
    if (alignment == 'center') {
        origin.x -= dimensions.advance / 2;
    } else if (alignment == 'right') {
        origin.x -= dimensions.advance;
    }


    var scale = size / 24;
    for (var i = 0; i < shaping.length; i++) {
        var shape = shaping[i];
        var font = faces[shape.face];
        var info = this.getGlyph(font, shape.glyph);
        if (!info || !info.glyph) continue;

        var width = info.glyph.width;
        var height = info.glyph.height;

        if (width > 0 && height > 0 && info.rect) {
            width += font.buffer * 2;
            height += font.buffer * 2;

            // Increase to next number divisible by 4, but at least 1.
            // This is so we can scale down the texture coordinates and pack them
            // into 2 bytes rather than 4 bytes.
            width += (4 - width % 4);
            height += (4 - height % 4);

            var x1 = origin.x + (shape.x + info.glyph.left - font.buffer) * scale;
            var y1 = origin.y + (shape.y - info.glyph.top - font.buffer) * scale;

            var x2 = x1 + width * scale;
            var y2 = y1 + height * scale;

            var tl = vectorMul(matrix, { x: x1, y: y1 });
            var tr = vectorMul(matrix, { x: x2, y: y1 });
            var bl = vectorMul(matrix, { x: x1, y: y2 });
            var br = vectorMul(matrix, { x: x2, y: y2 });

            var texX = info.rect.x;
            var texY = info.rect.y;

            // first triangle
            buffer.add(anchor.x, anchor.y, tl.x, tl.y, texX, texY, angle);
            buffer.add(anchor.x, anchor.y, tr.x, tr.y, texX + width, texY, angle);
            buffer.add(anchor.x, anchor.y, bl.x, bl.y, texX, texY + height, angle);

            // second triangle
            buffer.add(anchor.x, anchor.y, tr.x, tr.y, texX + width, texY, angle);
            buffer.add(anchor.x, anchor.y, bl.x, bl.y, texX, texY + height, angle);
            buffer.add(anchor.x, anchor.y, br.x, br.y, texX + width, texY + height, angle);
        }

        // pos.x += info.glyph.advance * scale;
    }

};



GlyphAtlas.prototype.measureText = function(faces, shaping, size) {
    var dimensions = {
        advance: 0
    };

    // TODO: advance is not calculated correctly. we should instead use the
    // bounding box of the glyph placement.

    var scale = size / 24;
    for (var i = 0; i < shaping.length; i++) {
        var info = shaping[i];
        var glyph = faces[info.face].glyphs[info.glyph];
        dimensions.advance += glyph.advance * scale;
    }

    return dimensions;
};
