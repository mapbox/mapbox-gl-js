'use strict';

var util = require('../../util/util');
var Buffer2 = require('../buffer2');

function CircleVertexBuffer(options) {
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

CircleVertexBuffer.prototype = util.inherit(Buffer2, {
    add: function(x, y, extrudeX, extrudeY) {
        this.push([
            (x * 2) + ((extrudeX + 1) / 2),
            (y * 2) + ((extrudeY + 1) / 2)
        ]);
    },
    bind: function(gl, shader, offset) {
        Buffer2.prototype.bind.call(this, gl);

        gl.vertexAttribPointer(shader.a_pos, 2,
            gl.SHORT, false,
            this.itemSize, offset + 0);
    }
});

module.exports = CircleVertexBuffer;
