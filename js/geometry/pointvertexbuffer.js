'use strict';

var Buffer = require('./buffer.js');

module.exports = PointVertexBuffer;

function PointVertexBuffer(buffer) {
    Buffer.call(this, buffer);
}

PointVertexBuffer.prototype = Object.create(Buffer.prototype);

PointVertexBuffer.prototype.defaultLength = 2048 * 14;
PointVertexBuffer.prototype.itemSize = 14;

// Converts the 0..2pi to an int16 range
PointVertexBuffer.angleFactor = 128 / Math.PI;

PointVertexBuffer.prototype.add = function(x, y, size, tl, br, angle, pointminzoom, angleRange) {
    var pos = this.pos,
        pos2 = pos / 2,
        angleFactor = PointVertexBuffer.angleFactor;

    this.resize();

    this.shorts[pos2 + 0] = x;
    this.shorts[pos2 + 1] = y;

    this.ubytes[pos + 4] = size[0];
    this.ubytes[pos + 5] = size[1];
    this.ubytes[pos + 6] = tl[0];
    this.ubytes[pos + 7] = tl[1];
    this.ubytes[pos + 8] = br[0];
    this.ubytes[pos + 9] = br[1];
    this.ubytes[pos + 10] = Math.floor((pointminzoom || 0) * 10);
    this.ubytes[pos + 11] = Math.floor((angle + Math.PI * 2) % (Math.PI * 2) * angleFactor) % 256;
    this.ubytes[pos + 12] = Math.floor(angleRange[0] * angleFactor) % 256;
    this.ubytes[pos + 13] = Math.floor(angleRange[1] * angleFactor) % 256;

    this.pos += this.itemSize;
};
