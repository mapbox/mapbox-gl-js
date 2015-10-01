'use strict';

var util = require('../../util/util');
var Buffer = require('../buffer');

function CircleVertexBuffer(options) {
    Buffer.call(this, options || {
        type: Buffer.BufferType.VERTEX,
        attributes: [{
            name: 'pos',
            components: 2,
            type: Buffer.AttributeType.SHORT
        }]
    });
}

CircleVertexBuffer.prototype = util.inherit(Buffer);

module.exports = CircleVertexBuffer;
