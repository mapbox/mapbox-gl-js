'use strict';

var Buffer = require('./buffer.js');

module.exports = PointVertexBuffer;

function PointVertexBuffer(buffer) {
    Buffer.call(this, buffer);
}

PointVertexBuffer.prototype = Object.create(Buffer.prototype);

PointVertexBuffer.prototype.defaultLength = 2048;
PointVertexBuffer.prototype.itemSize = 16;

// Converts the 0..2pi to an int16 range
PointVertexBuffer.angleFactor = 128 / Math.PI;

PointVertexBuffer.prototype.add = function(x, y, angle, pointminzoom, angleRange) {
    var pos = this.pos,
        pos2 = pos / 2,
        angleFactor = PointVertexBuffer.angleFactor;

    this.resize(this.itemSize);

    this.shorts[pos2 + 0] = x;
    this.shorts[pos2 + 1] = y;
    /*
    this.shorts[pos2 + 2] = Math.round(ox * 64); // use 1/64 pixels for placement
    this.shorts[pos2 + 3] = Math.round(oy * 64);
    this.ubytes[pos + 8] = Math.floor(tx / 4);
    this.ubytes[pos + 9] = Math.floor(ty / 4);
    */
    this.ubytes[pos + 10] = Math.floor((pointminzoom || 0) * 10);
    this.ubytes[pos + 13] = Math.floor((angle + Math.PI * 2) % (Math.PI * 2) * angleFactor) % 256;
    this.ubytes[pos + 14] = Math.floor(angleRange[0] * angleFactor) % 256;
    this.ubytes[pos + 15] = Math.floor(angleRange[1] * angleFactor) % 256;

    this.pos += this.itemSize;
};
