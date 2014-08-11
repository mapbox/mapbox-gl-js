'use strict';

var util = require('../../util/util');
var Buffer = require('./buffer');

module.exports = FillElementsBuffer;

function FillElementsBuffer(buffer) {
    Buffer.call(this, buffer);
}

FillElementsBuffer.prototype = util.inherit(Buffer, {
    itemSize: 2, // bytes per triangle (3 * unsigned short == 6 bytes)
    arrayType: 'ELEMENT_ARRAY_BUFFER',

    add(a) {
        var pos2 = this.pos / 2;

        this.resize();

        this.ushorts[pos2 + 0] = a;

        this.pos += this.itemSize;
    }
});
