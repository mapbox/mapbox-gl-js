'use strict';

var util = require('../../util/util');
var Buffer = require('../buffer');

function LineVertexBuffer(options) {
    Buffer.call(this, options || {
        type: Buffer.BufferType.VERTEX,
        attributes: [{
            name: 'pos',
            components: 2,
            type: Buffer.AttributeType.SHORT
        }, {
            name: 'data',
            components: 4,
            type: Buffer.AttributeType.BYTE
        }]
    });
}

// NOTE ON EXTRUDE SCALE:
// scale the extrusion vector so that the normal length is this value.
// contains the "texture" normals (-1..1). this is distinct from the extrude
// normals for line joins, because the x-value remains 0 for the texture
// normal array, while the extrude normal actually moves the vertex to create
// the acute/bevelled line join.
var EXTRUDE_SCALE = 63;

LineVertexBuffer.prototype = util.inherit(Buffer, {
    add: function(point, extrude, tx, ty, linesofar) {
        return this.push(
            (point.x << 1) | tx,
            (point.y << 1) | ty,
            Math.round(EXTRUDE_SCALE * extrude.x),
            Math.round(EXTRUDE_SCALE * extrude.y),
            linesofar / 128,
            linesofar % 128
        );
    }
});

module.exports = LineVertexBuffer;
