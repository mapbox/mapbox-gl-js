'use strict';

var util = require('../../util/util');
var Buffer2 = require('../buffer2');

function CollisionBoxVertexBuffer(options) {
    Buffer2.call(this, options || {
        type: Buffer2.BufferType.VERTEX,
        attributes: {
            verticies: {
                components: 6, // bytes per vertex (2 * short + 1 * short + 2 * byte = 8 bytes)
                type: Buffer2.AttributeType.UNSIGNED_SHORT
            }
        }
    });
}

CollisionBoxVertexBuffer.prototype = util.inherit(Buffer2, {
    // add a vertex to this buffer;
    // x, y - vertex position
    // ex, ey - extrude normal
    add: function(point, extrude, maxZoom, placementZoom) {
        this.push([
            point.x,
            point.y,
            Math.round(extrude.x),
            Math.round(extrude.y),
            Math.floor(maxZoom * 10),
            Math.floor(placementZoom * 10)
        ]);
    }
});

module.exports = CollisionBoxVertexBuffer;
