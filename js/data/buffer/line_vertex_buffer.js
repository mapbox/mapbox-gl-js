'use strict';

var util = require('../../util/util');
var Buffer2 = require('../buffer2');

function LineVertexBuffer(options) {
    Buffer2.call(this, options || {
        type: Buffer2.BufferType.VERTEX,
        attributes: {
            shorts: {
                components: 2,
                type: Buffer2.AttributeType.SHORT
            },
            bytes: {
                components: 4,
                type: Buffer2.AttributeType.BYTE
            }
        }
    });
}

// NOTE ON EXTRUDE SCALE:
// scale the extrusion vector so that the normal length is this value.
// contains the "texture" normals (-1..1). this is distinct from the extrude
// normals for line joins, because the x-value remains 0 for the texture
// normal array, while the extrude normal actually moves the vertex to create
// the acute/bevelled line join.

LineVertexBuffer.prototype = util.inherit(Buffer2, {
    extrudeScale: 63,
    add: function(point, extrude, tx, ty, linesofar) {
        var pos = this.pos,
            pos2 = pos / 2,
            index = this.index,
            extrudeScale = this.extrudeScale;

        this.push({
            shorts: [
                (Math.floor(point.x) * 2) | tx,
                (Math.floor(point.y) * 2) | ty
            ],
            bytes: [
                Math.round(extrudeScale * extrude.x),
                Math.round(extrudeScale * extrude.y),
                (linesofar || 0) / 128,
                (linesofar || 0) % 128
            ]
        });
    }
});

module.exports = LineVertexBuffer;
