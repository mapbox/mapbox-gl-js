'use strict';

var util = require('../../util/util');
var Buffer = require('../buffer');

function CollisionBoxVertexBuffer(options) {
    Buffer.call(this, options || {
        type: Buffer.BufferType.VERTEX,
        attributes: [{
            name: 'pos',
            type: Buffer.AttributeType.SHORT,
            components: 2
        }, {
            name: 'extrude',
            type: Buffer.AttributeType.SHORT,
            components: 2
        }, {
            name: 'data',
            type: Buffer.AttributeType.UNSIGNED_BYTE,
            components: 2
        }]
    });
}

CollisionBoxVertexBuffer.prototype = util.inherit(Buffer);

module.exports = CollisionBoxVertexBuffer;
