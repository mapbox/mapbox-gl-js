'use strict';

const createStructArrayType = require('../util/struct_array');

module.exports = createElementArrayType;

/**
 * An element array stores Uint16 indicies of vertexes in a corresponding vertex array. With no
 * arguments, it defaults to three components per element, forming triangles.
 * @private
 */
function createElementArrayType(components) {
    return createStructArrayType({
        members: [{
            type: 'Uint16',
            name: 'vertices',
            components: components || 3
        }]
    });
}
