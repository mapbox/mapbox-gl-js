function Font(data) {
    this.glyphs = {};

    var buffer = new Protobuf(data);
    var end = buffer.length;

    var val, tag;
    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;
        if (tag == 1) {
            this.family = buffer.readString();
        } else if (tag == 2) {
            this.style = buffer.readString();
        } else if (tag == 3) {
            this.buffer = buffer.readVarint();
        } else if (tag == 4) {
            this.size = buffer.readVarint();
        } else if (tag == 5) {
            this.readGlyph(buffer);
        } else {
            console.warn('skipping', tag);
            buffer.skip(val);
        }
    }
}

Font.prototype.readGlyph = function(buffer) {
    var bytes = buffer.readVarint();
    var end = buffer.pos + bytes;

    var code;
    var glyph = {};

    var val, tag;
    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;
        if (tag == 1) {
            code = buffer.readVarint();
        } else if (tag == 2) {
            var bitmap_bytes = buffer.readVarint();
            glyph.bitmap = buffer.buf.subarray(buffer.pos, buffer.pos + bitmap_bytes);
            buffer.pos += bitmap_bytes;
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

    this.glyphs[code] = glyph;
};
