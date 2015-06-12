'use strict';

var util = require('../../util/util');
var Buffer = require('./buffer');

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

LineVertexBuffer.prototype = util.inherit(Buffer, {
    itemSize: 8, // bytes per vertex (2 * short + 1 * short + 2 * byte = 8 bytes)
    defaultLength: 32768,

    // add a vertex to this buffer;
    // x, y - vertex position
    // ex, ey - extrude normal
    // tx, ty - texture normal
    add: function(point, extrude, tx, ty, linesofar) {
        var pos = this.pos,
            pos2 = pos / 2,
            index = this.index,
            extrudeScale = LineVertexBuffer.extrudeScale;

        this.resize();

        this.shorts[pos2 + 0] = (Math.floor(point.x) * 2) | tx;
        this.shorts[pos2 + 1] = (Math.floor(point.y) * 2) | ty;

        this.bytes[pos + 4] = Math.round(extrudeScale * extrude.x);
        this.bytes[pos + 5] = Math.round(extrudeScale * extrude.y);
        this.bytes[pos + 6] = (linesofar || 0) / 128;

        this.pos += this.itemSize;
        return index;
    },

    addColor: function(index, offset, color) {
        var pos = index * this.itemSize + offset;
        this.ubytes[pos + 0] = color[0];
        this.ubytes[pos + 1] = color[1];
        this.ubytes[pos + 2] = color[2];
        this.ubytes[pos + 3] = color[3];
    },

    addWidth: function(index, offset, width) {
        var pos = index * this.itemSize + offset;
        this.ubytes[pos + 0] = width;
    },

    addBlur: function(index, offset, blur) {
        var pos = index * this.itemSize + offset;
        this.ubytes[pos + 0] = blur;
    },

    addOpacity: function(index, offset, opacity) {
        var pos = index * this.itemSize + offset;
        this.ubytes[pos + 0] = Math.round(opacity * 255);
    }
});
