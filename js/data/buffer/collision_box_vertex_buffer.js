'use strict';

var util = require('../../util/util');
var Buffer = require('./buffer');

module.exports = CollisionBoxVertexBuffer;

function CollisionBoxVertexBuffer(buffer) {
    Buffer.call(this, buffer);
}

CollisionBoxVertexBuffer.prototype = util.inherit(Buffer, {
    itemSize: 12, // bytes per vertex (2 * short + 1 * short + 2 * byte = 8 bytes)
    defaultLength: 32768,

    // add a vertex to this buffer;
    // x, y - vertex position
    // ex, ey - extrude normal
    add: function(point, extrude, maxZoom, placementZoom) {
        var pos = this.pos,
            pos2 = pos / 2,
            index = this.index;

        this.resize();

        this.shorts[pos2 + 0] = point.x;
        this.shorts[pos2 + 1] = point.y;

        this.shorts[pos2 + 2] = Math.round(extrude.x);
        this.shorts[pos2 + 3] = Math.round(extrude.y);
        this.bytes[pos + 8] = Math.floor(maxZoom * 10) - 128;
        this.bytes[pos + 9] = Math.floor(placementZoom * 10) - 128;

        this.pos += this.itemSize;
        return index;
    }
});
