'use strict';

var util = require('../../util/util');
var Buffer2 = require('../buffer2');

function OutlineElementBuffer(options) {
    Buffer2.call(this, options || {
        type: Buffer2.BufferType.ELEMENT,
        attributes: {
            verticies: {
                components: 2,
                type: Buffer2.AttributeType.UNSIGNED_SHORT
            }
        }
    });
}

OutlineElementBuffer.prototype = util.inherit(Buffer2, {
    add: function(a, b){
        this.push([a, b]);
    }
});

module.exports = OutlineElementBuffer;
