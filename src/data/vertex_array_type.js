// @flow

const createStructArrayType = require('../util/struct_array');

import type {ViewType} from '../util/struct_array';

module.exports = createVertexArrayType;

/**
 * A vertex array stores data for each vertex in a geometry. Elements are aligned to 4 byte
 * boundaries for best performance in WebGL.
 * @private
 */
function createVertexArrayType(members: $ReadOnlyArray<{
    name: string,
    type: ViewType,
    +components?: number,
}>) {
    return createStructArrayType({
        members: members,
        alignment: 4
    });
}
