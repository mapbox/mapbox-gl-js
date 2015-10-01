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

OutlineElementBuffer.prototype = util.inherit(Buffer);

module.exports = OutlineElementBuffer;
