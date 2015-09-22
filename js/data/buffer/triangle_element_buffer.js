'use strict';

var util = require('../../util/util');
var Buffer = require('../buffer');

function TriangleElementBuffer(options) {
    Buffer.call(this, options || {
        type: Buffer.BufferType.ELEMENT,
        attributes: [{
            name: 'vertices',
            components: 3,
            type: Buffer.ELEMENT_ATTRIBUTE_TYPE
        }]
    });
}

TriangleElementBuffer.prototype = util.inherit(Buffer, {
    add: function(a, b, c) {
        this.push(a, b, c);
    }
});

module.exports = TriangleElementBuffer;
