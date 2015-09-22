'use strict';

var util = require('../../util/util');
var Buffer = require('../buffer');

function OutlineElementBuffer(options) {
    Buffer.call(this, options || {
        type: Buffer.BufferType.ELEMENT,
        attributes: [{
            name: 'vertices',
            components: 2,
            type: Buffer.ELEMENT_ATTRIBUTE_TYPE
        }]
    });
}

OutlineElementBuffer.prototype = util.inherit(Buffer, {
    add: function(a, b) {
        this.push(a, b);
    }
});

module.exports = OutlineElementBuffer;
