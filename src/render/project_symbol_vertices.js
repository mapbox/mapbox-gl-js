'use strict';

const Point = require('point-geometry');
const Buffer = require('../data/buffer');
const createStructArrayType = require('../util/struct_array');

const mat4 = require('@mapbox/gl-matrix').mat4;
const vec4 = require('@mapbox/gl-matrix').vec4;

const VertexPositionArray = createStructArrayType({
    members: [
        { type: 'Float32', name: 'a_projected_pos', components: 2 }
    ]
});

module.exports = projectSymbolVertices;

function project(point, matrix) {
    const pos = [point.x, point.y, 0, 1];
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
        const line = bucket.lineArray.get(vert.lineIndex);

        const fontScale = 0.8;
        let prev = project(new Point(vert.anchorX, vert.anchorY), pixelMatrix);
        let angle = 0;

        if (line.length > 1) {

            let dir, numVertices, start;

            if (vert.glyphOffsetX > 0) {
                dir = 1;
                numVertices = line.length - vert.segment;
                start = line.startIndex + vert.segment + 1;
            } else {
                dir = -1;
                numVertices = vert.segment;
                start = line.startIndex + vert.segment;
                angle = Math.PI;
            }

            let distanceRemaining = Math.abs(vert.glyphOffsetX) * fontScale;
            for (let i = 0; i < numVertices; i++) {
                const next_ = bucket.lineVertexArray.get(start + i * dir);
                const next = project(new Point(next_.x, next_.y), pixelMatrix);

                const d = prev.dist(next);

                if (distanceRemaining < d) {
                    prev = next.sub(prev)._mult(distanceRemaining / d)._add(prev);
                    angle += Math.atan2(next.y - prev.y, next.x - prev.x);
                    break;

                } else {
                    distanceRemaining -= d;
                    prev = next;
                }
            }
        } else {
            prev.x += vert.glyphOffsetX * fontScale;
        }


        const p = prev;
        p._add(new Point(vert.cornerOffsetX * fontScale, (vert.glyphOffsetY + vert.cornerOffsetY) * fontScale)._rotate(angle));


        const glx = p.x / tr.width * 2 - 1;
        const gly = (tr.height - p.y) / tr.height * 2 - 1;

        vertexPositions.emplaceBack(glx, gly);
    }

    return new Buffer(vertexPositions.serialize(), VertexPositionArray.serialize(), Buffer.BufferType.VERTEX);
}
