'use strict';

var util = require('../../util/util');
var Buffer2 = require('../buffer2');

function TriangleElementBuffer(options) {
    Buffer2.call(this, options || {
        type: Buffer2.BufferType.ELEMENT,
        attributes: {
            verticies: {
                components: 3,
                type: Buffer2.AttributeType.UNSIGNED_SHORT
            }
        }
    });
}

TriangleElementBuffer.prototype = util.inherit(Buffer2, {
    add: function(a, b, c) {
        this.push([a, b, c]);
    }
});

module.exports = TriangleElementBuffer;
