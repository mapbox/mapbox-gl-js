'use strict';

var Buffer = require('../data/buffer');

// NOTE ON EXTRUDE SCALE:
// scale the extrusion vector so that the normal length is this value.
// contains the "texture" normals (-1..1). this is distinct from the extrude
// normals for line joins, because the x-value remains 0 for the texture
// normal array, while the extrude normal actually moves the vertex to create
// the acute/bevelled line join.
var EXTRUDE_SCALE = 63;

module.exports = {

    name: 'line',

    shaders: {

        line: {
            vertexBuffer: 'lineVertex',
            elementBuffer: 'lineElement',

            attributes: [{
                name: 'pos',
                components: 2,
                type: Buffer.AttributeType.SHORT,
                value: function(point, extrude, tx, ty) {
                    return [
                        (point.x << 1) | tx,
                        (point.y << 1) | ty
                    ];
                }
            }, {
                name: 'data',
                components: 4,
                type: Buffer.AttributeType.BYTE,
                value: function(point, extrude, tx, ty, linesofar) {
                    return [
                        Math.round(EXTRUDE_SCALE * extrude.x),
                        Math.round(EXTRUDE_SCALE * extrude.y),
                        linesofar / 128,
                        linesofar % 128
                    ];
                }
            }]
        }
    }

};
