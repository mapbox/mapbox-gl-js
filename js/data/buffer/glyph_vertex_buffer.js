'use strict';

var util = require('../../util/util');
var Buffer = require('./buffer');

module.exports = GlyphVertexBuffer;

function GlyphVertexBuffer(buffer) {
    Buffer.call(this, buffer);
}

// Converts the 0..2pi to an int16 range
GlyphVertexBuffer.angleFactor = 128 / Math.PI;

GlyphVertexBuffer.prototype = util.inherit(Buffer, {
    defaultLength: 2048 * 16,
    itemSize: 16,

    add(x, y, ox, oy, tx, ty, angle, minzoom, range, maxzoom, labelminzoom) {
        var pos = this.pos,
            pos2 = pos / 2,
            angleFactor = GlyphVertexBuffer.angleFactor;

        this.resize();

        this.shorts[pos2 + 0] = x;
        this.shorts[pos2 + 1] = y;
        this.shorts[pos2 + 2] = Math.round(ox * 64); // use 1/64 pixels for placement
        this.shorts[pos2 + 3] = Math.round(oy * 64);

        this.ubytes[pos + 8] = Math.floor((labelminzoom || 0) * 10);
        this.ubytes[pos + 9] = Math.floor((minzoom || 0) * 10); // 1/10 zoom levels: z16 == 160.
        this.ubytes[pos + 10] = Math.floor(Math.min(maxzoom || 25, 25) * 10); // 1/10 zoom levels: z16 == 160.
        this.ubytes[pos + 11] = Math.round(angle * angleFactor) % 256;
        this.ubytes[pos + 12] = Math.max(Math.round(range[0] * angleFactor), 0) % 256;
        this.ubytes[pos + 13] = Math.min(Math.round(range[1] * angleFactor), 255) % 256;

        this.ubytes[pos + 14] = Math.floor(tx / 4);
        this.ubytes[pos + 15] = Math.floor(ty / 4);

        this.pos += this.itemSize;
    },

    bind(gl, shader) {
        Buffer.prototype.bind.call(this, gl);

        var stride = this.itemSize;

        gl.vertexAttribPointer(shader.a_pos, 2, gl.SHORT, false, stride, 0);
        gl.vertexAttribPointer(shader.a_offset, 2, gl.SHORT, false, stride, 4);

        gl.vertexAttribPointer(shader.a_labelminzoom, 1, gl.UNSIGNED_BYTE, false, stride, 8);
        gl.vertexAttribPointer(shader.a_minzoom, 1, gl.UNSIGNED_BYTE, false, stride, 9);
        gl.vertexAttribPointer(shader.a_maxzoom, 1, gl.UNSIGNED_BYTE, false, stride, 10);
        gl.vertexAttribPointer(shader.a_angle, 1, gl.UNSIGNED_BYTE, false, stride, 11);
        gl.vertexAttribPointer(shader.a_rangeend, 1, gl.UNSIGNED_BYTE, false, stride, 12);
        gl.vertexAttribPointer(shader.a_rangestart, 1, gl.UNSIGNED_BYTE, false, stride, 13);

        gl.vertexAttribPointer(shader.a_tex, 2, gl.UNSIGNED_BYTE, false, stride, 14);
    }
});
