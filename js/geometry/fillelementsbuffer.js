'use strict';

var Buffer = require('./buffer.js');

module.exports = FillElementsBuffer;
function FillElementsBuffer(buffer) {
    Buffer.call(this, buffer);
}

FillElementsBuffer.prototype = Object.create(Buffer.prototype);

FillElementsBuffer.prototype.itemSize = 6; // bytes per triangle (3 * unsigned short == 6 bytes)
FillElementsBuffer.prototype.defaultType = Uint16Array;
FillElementsBuffer.prototype.arrayType = 'ELEMENT_ARRAY_BUFFER';

FillElementsBuffer.prototype.add = function(a, b, c) {
    this.resize(this.itemSize);
    this.coords[this.pos / 2 + 0] = a;
    this.coords[this.pos / 2 + 1] = b;
    this.coords[this.pos / 2 + 2] = c;
    this.pos += this.itemSize;
};
