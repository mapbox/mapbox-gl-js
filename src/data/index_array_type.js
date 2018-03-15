// @flow

/**
 * An index array stores Uint16 indicies of vertexes in a corresponding vertex array. We use
 * two kinds of index arrays: arrays storing groups of three indicies, forming triangles; and
 * arrays storing pairs of indicies, forming line segments.
 * @private
 */
module.exports = {
    LineIndexArray: require('./array_types').LineIndexArray,
    TriangleIndexArray: require('./array_types').TriangleIndexArray
};
