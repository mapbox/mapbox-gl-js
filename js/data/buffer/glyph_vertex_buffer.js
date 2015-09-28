'use strict';

var util = require('../../util/util');
var Buffer2 = require('../buffer2');

function GlyphVertexBuffer(options) {
    Buffer2.call(this, options || {
        type: Buffer2.BufferType.VERTEX,
        attributes: {
            pos: {
                components: 2,
                type: Buffer2.AttributeType.SHORT
            },
            extrude: {
                components: 2,
                type: Buffer2.AttributeType.SHORT
            },
            data: {
                components: 8,
                type: Buffer2.AttributeType.UNSIGNED_BYTE
            }
        }
    });
}

GlyphVertexBuffer.prototype = util.inherit(Buffer2, {
    add: function(x, y, ox, oy, tx, ty, minzoom, maxzoom, labelminzoom) {
        this.push({
            pos: [
                x,
                y
            ],
            extrude: [
                Math.round(ox * 64), // use 1/64 pixels for placement
                Math.round(oy * 64)
            ],
            data: [
                Math.floor(tx / 4), /* tex */
                Math.floor(ty / 4), /* tex */
                Math.floor((labelminzoom) * 10), /* labelminzoom */
                0,
                Math.floor((minzoom) * 10), /* minzoom */
                Math.floor(Math.min(maxzoom, 25) * 10), /* maxzoom */
                0,
                0
            ]
        });
    },
    bind: function(gl, shader, offset) {
        Buffer2.prototype.bind.call(this, gl);

        var stride = this.itemSize;

        gl.vertexAttribPointer(shader.a_pos, 2, gl.SHORT, false, stride, offset + 0);
        gl.vertexAttribPointer(shader.a_offset, 2, gl.SHORT, false, stride, offset + 4);

        gl.vertexAttribPointer(shader.a_data1, 4, gl.UNSIGNED_BYTE, false, stride, offset + 8);
        gl.vertexAttribPointer(shader.a_data2, 2, gl.UNSIGNED_BYTE, false, stride, offset + 12);
    }
});

module.exports = GlyphVertexBuffer;
