'use strict';

var util = require('../../util/util');
var Buffer = require('../buffer');

function GlyphVertexBuffer(options) {
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

GlyphVertexBuffer.prototype = util.inherit(Buffer, {
    add: function(x, y, ox, oy, tx, ty, minzoom, maxzoom, labelminzoom) {
        this.push(
            x, y,
            Math.round(ox * 64), // use 1/64 pixels for placement
            Math.round(oy * 64),
            Math.floor(tx / 4), /* tex */
            Math.floor(ty / 4), /* tex */
            Math.floor((labelminzoom) * 10), /* labelminzoom */
            0,
            Math.floor((minzoom) * 10), /* minzoom */
            Math.floor(Math.min(maxzoom, 25) * 10), /* maxzoom */
            0,
            0
        );
    },
    bind: function(gl, shader, offset) {
        Buffer.prototype.bind.call(this, gl);

        var stride = this.itemSize;

        gl.vertexAttribPointer(shader.a_pos, 2, gl.SHORT, false, stride, offset + 0);
        gl.vertexAttribPointer(shader.a_offset, 2, gl.SHORT, false, stride, offset + 4);

        gl.vertexAttribPointer(shader.a_data1, 4, gl.UNSIGNED_BYTE, false, stride, offset + 8);
        gl.vertexAttribPointer(shader.a_data2, 2, gl.UNSIGNED_BYTE, false, stride, offset + 12);
    }
});

module.exports = GlyphVertexBuffer;
