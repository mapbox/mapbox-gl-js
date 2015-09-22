'use strict';

var util = require('../../util/util');
var Buffer = require('../buffer');

function CollisionBoxVertexBuffer(options) {
    Buffer.call(this, options || {
        type: Buffer.BufferType.VERTEX,
        attributes: [{
            name: 'pos',
            type: Buffer.AttributeType.SHORT,
            components: 2
        }, {
            name: 'extrude',
            type: Buffer.AttributeType.SHORT,
            components: 2
        }, {
            name: 'data',
            type: Buffer.AttributeType.UNSIGNED_BYTE,
            components: 2
        }]
    });
}

CollisionBoxVertexBuffer.prototype = util.inherit(Buffer, {
    // add a vertex to this buffer;
    // x, y - vertex position
    // ex, ey - extrude normal
    add: function(point, extrude, maxZoom, placementZoom) {
        this.push(
            point.x,
            point.y,
            Math.round(extrude.x),
            Math.round(extrude.y),
            Math.floor(maxZoom * 10),
            Math.floor(placementZoom * 10)
        );
    }
});

module.exports = CollisionBoxVertexBuffer;
