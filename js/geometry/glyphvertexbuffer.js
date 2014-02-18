'use strict';

var Buffer = require('./buffer.js');

module.exports = GlyphVertexBuffer;
function GlyphVertexBuffer(buffer) {
    Buffer.call(this, buffer);
}

GlyphVertexBuffer.prototype = Object.create(Buffer.prototype);

GlyphVertexBuffer.prototype.defaultLength = 2048;
GlyphVertexBuffer.prototype.itemSize = 16;

// Converts the 0..2pi to an int16 range
GlyphVertexBuffer.angleFactor = 128 / Math.PI;

GlyphVertexBuffer.prototype.add = function(x, y, ox, oy, tx, ty, angle, minzoom, range, maxzoom, labelminzoom) {
    var pos = this.pos,
        pos2 = pos / 2,
        angleFactor = GlyphVertexBuffer.angleFactor;

    this.resize(this.itemSize);

    this.shorts[pos2 + 0] = x;
    this.shorts[pos2 + 1] = y;
    this.shorts[pos2 + 2] = Math.round(ox * 64); // use 1/64 pixels for placement
    this.shorts[pos2 + 3] = Math.round(oy * 64);

    this.ubytes[pos + 8] = Math.floor(tx / 4);
    this.ubytes[pos + 9] = Math.floor(ty / 4);
    this.ubytes[pos + 10] = Math.floor((labelminzoom || 0) * 10);
    this.ubytes[pos + 11] = Math.floor((minzoom || 0) * 10); // 1/10 zoom levels: z16 == 160.
    this.ubytes[pos + 12] = Math.floor(Math.min(maxzoom || 25, 25) * 10); // 1/10 zoom levels: z16 == 160.
    this.ubytes[pos + 13] = Math.floor(angle * angleFactor) % 256;
    this.ubytes[pos + 14] = Math.floor(range[0] * angleFactor) % 256;
    this.ubytes[pos + 15] = Math.floor(range[1] * angleFactor) % 256;

    this.pos += this.itemSize;
};
