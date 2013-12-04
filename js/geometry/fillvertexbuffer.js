'use strict';

var Buffer = require('./buffer.js');

module.exports = FillVertexBuffer;
function FillVertexBuffer(buffer) {
    Buffer.call(this, buffer);
}

FillVertexBuffer.prototype = Object.create(Buffer.prototype);

FillVertexBuffer.prototype.itemSize = 4; // bytes per vertex (2 * short == 4 bytes)

FillVertexBuffer.prototype.add = function(x, y) {
    this.resize(this.itemSize);
    this.coords[this.pos / 2 + 0] = x;
    this.coords[this.pos / 2 + 1] = y;
    this.pos += this.itemSize;
};

/*
 * Add a degenerate vertex (= out-of-viewplane) to the buffer.
 */
FillVertexBuffer.prototype.addDegenerate = function() {
    this.add(32767, 0);
};
