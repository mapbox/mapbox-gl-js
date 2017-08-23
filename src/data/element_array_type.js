// @flow

const createStructArrayType = require('../util/struct_array');

/**
 * An element array stores Uint16 indicies of vertexes in a corresponding vertex array. We use
 * two kinds of element arrays: arrays storing groups of three indicies, forming triangles; and
 * arrays storing pairs of indicies, forming line segments.
 * @private
 */

function createElementArrayType(components: number) {
    return createStructArrayType({
        members: [{
            type: 'Uint16',
            name: 'vertices',
            components
        }]
    });
}

module.exports = {
    LineElementArray: createElementArrayType(2),
    TriangleElementArray: createElementArrayType(3)
};
