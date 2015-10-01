'use strict';

var util = require('../../util/util');
var Buffer = require('../buffer');

function FillVertexBuffer(options) {
    Buffer.call(this, options || {
        type: Buffer.BufferType.VERTEX,
        attributes: [{
            name: 'pos',
            components: 2,
            type: Buffer.AttributeType.SHORT
        }]
    });
}

FillVertexBuffer.prototype = util.inherit(Buffer);

module.exports = FillVertexBuffer;
