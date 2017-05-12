'use strict';

const Buffer = require('../data/buffer');
const createStructArrayType = require('../util/struct_array');

const VertexPositionArray = createStructArrayType({
    members: [
        { type: 'Int16', name: 'a_projected_pos', components: 2 }
    ]
});

module.exports = projectSymbolVertices;

function projectSymbolVertices(bucket) {
    const vertexPositions = new VertexPositionArray();
    for (let i = 0; i < bucket.vertexTransformArray.length; i++) {
        const vert = bucket.vertexTransformArray.get(i);
        vertexPositions.emplaceBack(
                vert.cornerOffsetX,
                vert.cornerOffsetY);
    }

    return new Buffer(vertexPositions.serialize(), VertexPositionArray.serialize(), Buffer.BufferType.VERTEX);
}
