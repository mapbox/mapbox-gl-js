'use strict';

var util = require('../../util/util');
var Buffer = require('../buffer');

function SymbolVertexBuffer(options) {
    Buffer.call(this, options || {
        type: Buffer.BufferType.VERTEX,
        attributes: [{
            name: 'pos',
            components: 2,
            type: Buffer.AttributeType.SHORT
        }, {
            name: 'offset',
            components: 2,
            type: Buffer.AttributeType.SHORT
        }, {
            name: 'data1',
            components: 4,
            type: Buffer.AttributeType.UNSIGNED_BYTE
        }, {
            name: 'data2',
            components: 2,
            type: Buffer.AttributeType.UNSIGNED_BYTE
        }]
    });
}

SymbolVertexBuffer.prototype = util.inherit(Buffer);

module.exports = SymbolVertexBuffer;
