'use strict';

var util = require('../../util/util');
var Buffer2 = require('../buffer2');

function FillVertexBuffer(options) {
    Buffer2.call(this, options || {
        type: Buffer2.BufferType.VERTEX,
        attributes: {
            pos: {
                components: 2,
                type: Buffer2.AttributeType.UNSIGNED_SHORT
            }
        }
    });
}

FillVertexBuffer.prototype = util.inherit(Buffer2, {
    add: function(x, y) {
        this.push([x, y]);
    }
});

module.exports = FillVertexBuffer;
