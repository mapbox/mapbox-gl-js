'use strict';

var util = require('../../util/util');
var Buffer = require('./buffer');

module.exports = OutlineElementsBuffer;

function OutlineElementsBuffer(buffer) {
    Buffer.call(this, buffer);
}

OutlineElementsBuffer.prototype = util.inherit(Buffer, {
    itemSize: 4, // bytes per line (2 * unsigned short == 4 bytes)
    arrayType: 'ELEMENT_ARRAY_BUFFER',

    add: function(a, b) {
        var pos2 = this.pos / 2;

        this.resize();

        this.ushorts[pos2 + 0] = a;
        this.ushorts[pos2 + 1] = b;

        this.pos += this.itemSize;
    }
});
