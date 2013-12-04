'use strict';

var Buffer = require('./buffer.js');

/*
 * Create a simpler wrapper around a single arraybuffer with two views,
 * `coords` and `extrude`.
 */
module.exports = LineVertexBuffer;
function LineVertexBuffer(buffer) {
    Buffer.call(this, buffer);
}

// scale the extrusion vector so that the normal length is this value.
// contains the "texture" normals (-1..1). this is distinct from the extrude
// normals for line joins, because the x-value remains 0 for the texture
// normal array, while the extrude normal actually moves the vertex to create
// the acute/bevelled line join.
LineVertexBuffer.extrudeScale = 63;

LineVertexBuffer.prototype = Object.create(Buffer.prototype);

LineVertexBuffer.prototype.itemSize = 8; // bytes per vertex (2 * short + 1 * short + 2 * byte = 8 bytes)
LineVertexBuffer.prototype.defaultLength = 32768;
LineVertexBuffer.prototype.setupViews = function() {
    this.extrude = new Int8Array(this.array);
};

/*
 * Add a vertex to this buffer
 *
 * @param {number} x vertex position
 * @param {number} y vertex position
 * @param {number} ex extrude normal
 * @param {number} ey extrude normal
 * @param {number} tx texture normal
 * @param {number} ty texture normal
 */

LineVertexBuffer.prototype.add = function(x, y, ex, ey, tx, ty, linesofar, debug) {
    this.resize(this.itemSize);
    this.coords[this.pos / 2 + 0] = (Math.floor(x) * 2) | tx;
    this.coords[this.pos / 2 + 1] = (Math.floor(y) * 2) | ty;
    this.coords[this.pos / 2 + 2] = Math.round(linesofar || 0);
    this.extrude[this.pos + 6] = Math.round(LineVertexBuffer.extrudeScale * ex);
    this.extrude[this.pos + 7] = Math.round(LineVertexBuffer.extrudeScale * ey);
    //if (debug) console.log(this.extrude[this.pos + 7]);
    this.pos += this.itemSize;
};

/*
 * Add a degenerate triangle to the buffer
 *
 * > So we need a way to get from the end of one triangle strip
 * to the beginning of the next strip without actually filling triangles
 * on the way. We can do this with "degenerate" triangles: We simply
 * repeat the last coordinate of the first triangle strip and the first
 * coordinate of the next triangle strip.
 */
LineVertexBuffer.prototype.addDegenerate = function() {
    this.add(16383, 16383, 0, 0, 1, 1);
};
