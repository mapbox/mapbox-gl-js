'use strict';

var util = require('../../util/util');
var Buffer = require('../buffer');

function LineVertexBuffer(options) {
    Buffer.call(this, options || {
        type: Buffer.BufferType.VERTEX,
        attributes: [{
            name: 'pos',
            components: 2,
            type: Buffer.AttributeType.SHORT
        }, {
            name: 'data',
            components: 4,
            type: Buffer.AttributeType.BYTE
        }]
    });
}

LineVertexBuffer.prototype = util.inherit(Buffer);

module.exports = LineVertexBuffer;
