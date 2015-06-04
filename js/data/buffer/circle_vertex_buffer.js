'use strict';

var util = require('../../util/util');
var Buffer = require('./buffer');

module.exports = CircleVertexBuffer;

/**
 * This contains the data that displays circle markers on the map,
 * including their centerpoint
 */
function CircleVertexBuffer(buffer) {
    Buffer.call(this, buffer);
}

CircleVertexBuffer.prototype = util.inherit(Buffer, {
    defaultLength: 2048 * 16,

    itemSize: 8, // 2 bytes per short * 4 of them

    add: function(x, y, extrudeX, extrudeY) {
        var pos = this.pos,
            pos2 = pos / 2;

        this.resize();

        this.shorts[pos2 + 0] = x;
        this.shorts[pos2 + 1] = y;
        this.shorts[pos2 + 2] = extrudeX;
        this.shorts[pos2 + 3] = extrudeY;

        this.pos += this.itemSize;
    },

    bind: function(gl, shader, offset) {
        Buffer.prototype.bind.call(this, gl);

        gl.vertexAttribPointer(shader.a_pos, 2,
            gl.SHORT, false,
            this.itemSize, offset + 0);
        gl.vertexAttribPointer(shader.a_extrude, 2,
            gl.SHORT, false,
            this.itemSize, offset + 2);
    }
});
