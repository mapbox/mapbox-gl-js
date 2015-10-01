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
            name: 'extrude',
            components: 2,
            type: Buffer.AttributeType.SHORT
        }, {
            name: 'data1',
            components: 4,
            type: Buffer.AttributeType.UNSIGNED_BYTE
        }, {
            name: 'data2',
            components: 4,
            type: Buffer.AttributeType.UNSIGNED_BYTE
        }]
    });
}

SymbolVertexBuffer.prototype = util.inherit(Buffer, {
    bind: function(gl, shader, offset) {
        Buffer.prototype.bind.call(this, gl);

        var stride = this.itemSize;

        gl.vertexAttribPointer(shader.a_pos, 2, gl.SHORT, false, stride, offset + 0);
        gl.vertexAttribPointer(shader.a_offset, 2, gl.SHORT, false, stride, offset + 4);

        gl.vertexAttribPointer(shader.a_data1, 4, gl.UNSIGNED_BYTE, false, stride, offset + 8);
        gl.vertexAttribPointer(shader.a_data2, 2, gl.UNSIGNED_BYTE, false, stride, offset + 12);
    }
});

module.exports = SymbolVertexBuffer;
