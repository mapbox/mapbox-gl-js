'use strict';

var util = require('../../util/util');
var Buffer2 = require('../buffer2');

function CollisionBoxVertexBuffer(options) {
    Buffer2.call(this, options || {
        type: Buffer2.BufferType.VERTEX,
        attributes: {
            pos: {
                type: Buffer2.AttributeType.SHORT,
                components: 2
            },
            extrusions: {
                type: Buffer2.AttributeType.SHORT,
                components: 2
            },
            data: {
                type: Buffer2.AttributeType.UNSIGNED_BYTE,
                components: 2
            }
        }
    });
}

CollisionBoxVertexBuffer.prototype = util.inherit(Buffer2, {
    // add a vertex to this buffer;
    // x, y - vertex position
    // ex, ey - extrude normal
    add: function(point, extrude, maxZoom, placementZoom) {
        this.push({
            pos: [
                point.x,
                point.y
            ],
            extrusions: [
                Math.round(extrude.x),
                Math.round(extrude.y)
            ],
            data: [
                Math.floor(maxZoom * 10),
                Math.floor(placementZoom * 10)
            ]
        });
    }
});

module.exports = CollisionBoxVertexBuffer;
