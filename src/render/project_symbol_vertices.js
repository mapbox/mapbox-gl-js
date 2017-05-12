'use strict';

const Point = require('point-geometry');
const Buffer = require('../data/buffer');
const createStructArrayType = require('../util/struct_array');

const mat4 = require('@mapbox/gl-matrix').mat4;
const vec4 = require('@mapbox/gl-matrix').vec4;

const VertexPositionArray = createStructArrayType({
    members: [
        { type: 'Int16', name: 'a_projected_pos', components: 2 }
    ]
});

module.exports = projectSymbolVertices;

function project(x, y, matrix) {
    const pos = [x, y, 0, 1];
    vec4.transformMat4(pos, pos, matrix);
    return new Point(pos[0] / pos[3], pos[1] / pos[3]);
}

function projectSymbolVertices(bucket, tileMatrix, painter) {

    const tr = painter.transform;
    const m = mat4.create();
    mat4.scale(m, m, [tr.width / 2, -tr.height / 2, 1]);
    mat4.translate(m, m, [1, -1, 0]);
    const pixelMatrix = mat4.multiply(new Float64Array(16), m, tileMatrix);

    const vertexPositions = new VertexPositionArray();
    for (let i = 0; i < bucket.vertexTransformArray.length; i++) {
        const vert = bucket.vertexTransformArray.get(i);

        const p = project(vert.anchorX, vert.anchorY, pixelMatrix);

        p.x += (vert.glyphOffsetX + vert.cornerOffsetX);
        p.y += (vert.glyphOffsetY + vert.cornerOffsetY);


        const glx = p.x / tr.width * 2 - 1;
        const gly = (tr.height - p.y) / tr.height * 2 - 1;

        vertexPositions.emplaceBack(
                glx * 1000,
                gly * 1000);
    }

    return new Buffer(vertexPositions.serialize(), VertexPositionArray.serialize(), Buffer.BufferType.VERTEX);
}
