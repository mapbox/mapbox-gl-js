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

    add: function(x, y, ox, oy, tx, ty, angle, minzoom, range, maxzoom, labelminzoom) {
        var pos = this.pos,
            pos2 = pos / 2,
            angleFactor = GlyphVertexBuffer.angleFactor;

        this.resize();

        this.shorts[pos2 + 0] = x;
        this.shorts[pos2 + 1] = y;
        this.shorts[pos2 + 2] = Math.round(ox * 64); // use 1/64 pixels for placement
        this.shorts[pos2 + 3] = Math.round(oy * 64);

        // a_data1
        this.ubytes[pos + 8] /* tex */ = tx / 4;
        this.ubytes[pos + 9] /* tex */ = ty / 4;
        this.ubytes[pos + 10] /* labelminzoom */ = Math.floor((labelminzoom || 0) * 10);
        this.ubytes[pos + 11] /* angle */ = Math.round(angle * angleFactor) % 256;

        // a_data2
        this.ubytes[pos + 12] /* minzoom */ = Math.floor((minzoom || 0) * 10); // 1/10 zoom levels: z16 == 160.
        this.ubytes[pos + 13] /* maxzoom */ = Math.floor(Math.min(maxzoom || 25, 25) * 10); // 1/10 zoom levels: z16 == 160.
        this.ubytes[pos + 14] /* rangeend */ = Math.max(Math.round(range[0] * angleFactor), 0) % 256;
        this.ubytes[pos + 15] /* rangestart */ = Math.min(Math.round(range[1] * angleFactor), 255) % 256;

        this.pos += this.itemSize;
    },

    bind: function(gl, shader) {
        Buffer.prototype.bind.call(this, gl);

        var stride = this.itemSize;

        gl.vertexAttribPointer(shader.a_pos, 2, gl.SHORT, false, stride, 0);
        gl.vertexAttribPointer(shader.a_offset, 2, gl.SHORT, false, stride, 4);
        gl.vertexAttribPointer(shader.a_data1, 4, gl.UNSIGNED_BYTE, false, stride, 8);
        gl.vertexAttribPointer(shader.a_data2, 4, gl.UNSIGNED_BYTE, false, stride, 12);
    }
});
