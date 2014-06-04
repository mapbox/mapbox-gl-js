'use strict';

var Buffer = require('./buffer.js');

module.exports = PointVertexBuffer;

function PointVertexBuffer(buffer) {
    Buffer.call(this, buffer);
}

PointVertexBuffer.prototype = Object.create(Buffer.prototype);

PointVertexBuffer.prototype.defaultLength = 2048 * 16;
PointVertexBuffer.prototype.itemSize = 16;

// Converts the 0..2pi to an int16 range
PointVertexBuffer.angleFactor = 128 / Math.PI;

PointVertexBuffer.prototype.add = function(x, y, tl, br, angle, pointminzoom, angleRange) {
    var pos = this.pos,
        pos2 = pos / 2,
        angleFactor = PointVertexBuffer.angleFactor;

    this.resize();

    this.shorts[pos2 + 0] = x;
    this.shorts[pos2 + 1] = y;
    this.shorts[pos2 + 2] = tl[0];
    this.shorts[pos2 + 3] = tl[1];
    this.shorts[pos2 + 4] = br[0];
    this.shorts[pos2 + 5] = br[1];
    this.ubytes[pos + 12] = Math.floor((pointminzoom || 0) * 10);
    this.ubytes[pos + 13] = Math.floor((angle + Math.PI * 2) % (Math.PI * 2) * angleFactor) % 256;
    this.ubytes[pos + 14] = Math.floor(angleRange[0] * angleFactor) % 256;
    this.ubytes[pos + 15] = Math.floor(angleRange[1] * angleFactor) % 256;

    this.pos += this.itemSize;
};
