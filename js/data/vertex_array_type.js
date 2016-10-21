'use strict';

const StructArrayType = require('../util/struct_array');

/**
 * A vertex array stores data for each vertex in a geometry. Elements are aligned to 4 byte
 * boundaries for best performance in WebGL.
 * @private
 */
module.exports = function VertexArrayType(members) {
    return new StructArrayType({
        members: members,
        alignment: 4
    });
};
