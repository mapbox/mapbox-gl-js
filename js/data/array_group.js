'use strict';

const util = require('../util/util');

/**
 * A class that manages vertex and element arrays for a range of features. It handles initialization,
 * serialization for transfer to the main thread, and certain intervening mutations.
 *
 * Array elements are broken into array groups based on inherent limits of WebGL. Within a group is:
 *
 * * A "layout" vertex array, with fixed layout, containing values calculated from layout properties.
 * * Zero, one, or two element arrays, with fixed layout, typically for eventual use in
 *   `gl.drawElements(gl.TRIANGLES, ...)`.
 * * Zero or more "paint" vertex arrays keyed by layer ID, each with a dynamic layout which depends
 *   on which paint properties of that layer use data-driven-functions (property functions or
 *   property-and-zoom functions). Values are calculated by evaluating those functions.
 *
 * @private
 */
class ArrayGroup {
    constructor(arrayTypes) {
        const LayoutVertexArrayType = arrayTypes.layoutVertexArrayType;
        this.layoutVertexArray = new LayoutVertexArrayType();

        const ElementArrayType = arrayTypes.elementArrayType;
        if (ElementArrayType) this.elementArray = new ElementArrayType();

        const ElementArrayType2 = arrayTypes.elementArrayType2;
        if (ElementArrayType2) this.elementArray2 = new ElementArrayType2();

        this.paintVertexArrays = util.mapObject(arrayTypes.paintVertexArrayTypes, (PaintVertexArrayType) => {
            return new PaintVertexArrayType();
        });
    }

    hasCapacityFor(numVertices) {
        return this.layoutVertexArray.length + numVertices <= ArrayGroup.MAX_VERTEX_ARRAY_LENGTH;
    }

    isEmpty() {
        return this.layoutVertexArray.length === 0;
    }

    trim() {
        this.layoutVertexArray.trim();

        if (this.elementArray) {
            this.elementArray.trim();
        }

        if (this.elementArray2) {
            this.elementArray2.trim();
        }

        for (const layerName in this.paintVertexArrays) {
            this.paintVertexArrays[layerName].trim();
        }
    }

    serialize() {
        return {
            layoutVertexArray: this.layoutVertexArray.serialize(),
            elementArray: this.elementArray && this.elementArray.serialize(),
            elementArray2: this.elementArray2 && this.elementArray2.serialize(),
            paintVertexArrays: util.mapObject(this.paintVertexArrays, (array) => {
                return array.serialize();
            })
        };
    }

    getTransferables(transferables) {
        transferables.push(this.layoutVertexArray.arrayBuffer);

        if (this.elementArray) {
            transferables.push(this.elementArray.arrayBuffer);
        }

        if (this.elementArray2) {
            transferables.push(this.elementArray2.arrayBuffer);
        }

        for (const layerName in this.paintVertexArrays) {
            transferables.push(this.paintVertexArrays[layerName].arrayBuffer);
        }
    }
}

/**
 * The maximum size of a vertex array. This limit is imposed by WebGL's 16 bit
 * addressing of vertex buffers.
 * @private
 * @readonly
 */
ArrayGroup.MAX_VERTEX_ARRAY_LENGTH = Math.pow(2, 16) - 1;

module.exports = ArrayGroup;
