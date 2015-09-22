'use strict';

var util = require('../../util/util');
var Buffer = require('./buffer');

module.exports = CircleVertexBuffer;

/**
 * This contains the data that displays circle markers on the map,
 * including their centerpoint
 * @private
 */
function CircleVertexBuffer(buffer) {
    Buffer.call(this, buffer);
}

CircleVertexBuffer.prototype = util.inherit(Buffer, {
    defaultLength: 2048 * 16,

    itemSize: 4, // 2 bytes per short * 4 of them

    add: function(x, y, extrudeX, extrudeY) {
        var pos = this.pos,
            pos2 = pos / 2;

        this.resize();

        // pack the extrusion of -1 or 1 into one short
        this.shorts[pos2 + 0] = (x * 2) + ((extrudeX + 1) / 2);
        this.shorts[pos2 + 1] = (y * 2) + ((extrudeY + 1) / 2);

        this.pos += this.itemSize;
    },

    bind: function(gl, shader, offset) {
        Buffer.prototype.bind.call(this, gl);

        gl.vertexAttribPointer(shader.a_pos, 2,
            gl.SHORT, false,
            this.itemSize, offset + 0);
    }
});
