'use strict';

var Buffer = require('./buffer');

module.exports = FillVertexBuffer;

function FillVertexBuffer(buffer) {
    Buffer.call(this, buffer);
}

FillVertexBuffer.prototype = Object.create(Buffer.prototype);

FillVertexBuffer.prototype.itemSize = 4; // bytes per vertex (2 * short == 4 bytes)

FillVertexBuffer.prototype.add = function(x, y) {
    var pos2 = this.pos / 2;

    this.resize();

    this.shorts[pos2 + 0] = x;
    this.shorts[pos2 + 1] = y;

    this.pos += this.itemSize;
};
