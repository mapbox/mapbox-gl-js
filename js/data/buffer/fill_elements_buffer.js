'use strict';

var Buffer = require('./buffer');

module.exports = FillElementsBuffer;

function FillElementsBuffer(buffer) {
    Buffer.call(this, buffer);
}

FillElementsBuffer.prototype = Object.create(Buffer.prototype);

FillElementsBuffer.prototype.itemSize = 6; // bytes per triangle (3 * unsigned short == 6 bytes)
FillElementsBuffer.prototype.arrayType = 'ELEMENT_ARRAY_BUFFER';

FillElementsBuffer.prototype.add = function(a, b, c) {
    var pos2 = this.pos / 2;

    this.resize();

    this.ushorts[pos2 + 0] = a;
    this.ushorts[pos2 + 1] = b;
    this.ushorts[pos2 + 2] = c;

    this.pos += this.itemSize;
};
