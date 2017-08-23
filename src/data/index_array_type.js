// @flow

const createStructArrayType = require('../util/struct_array');

/**
 * An index array stores Uint16 indicies of vertexes in a corresponding vertex array. We use
 * two kinds of index arrays: arrays storing groups of three indicies, forming triangles; and
 * arrays storing pairs of indicies, forming line segments.
 * @private
 */

function createIndexArrayType(components: number) {
    return createStructArrayType({
        members: [{
            type: 'Uint16',
            name: 'vertices',
            components
        }]
    });
}

module.exports = {
    LineIndexArray: createIndexArrayType(2),
    TriangleIndexArray: createIndexArrayType(3)
};
