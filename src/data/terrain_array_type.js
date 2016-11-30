'use strict';

const createStructArrayType = require('../util/struct_array');

module.exports = createTerrainArrayType;

/**
 * A terrain array stores Uint16 indicies of vertexes in a corresponding vertex array. With no
 * arguments, it defaults to three components per Terrain, forming triangles.
 * @private
 */
function createTerrainArrayType(components) {
    return createStructArrayType({
        members: [{
            type: 'Uint32',
            name: 'elevation'
        }]
    });
}
