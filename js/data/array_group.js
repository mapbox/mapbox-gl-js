'use strict';

const util = require('../util/util');

class Segment {
    constructor(vertexOffset, primitiveOffset) {
        this.vertexOffset = vertexOffset;
        this.primitiveOffset = primitiveOffset;
        this.vertexLength = 0;
        this.primitiveLength = 0;
    }
}

/**
 * A class that manages vertex and element arrays for a bucket. It handles initialization,
 * serialization for transfer to the main thread, and certain intervening mutations.
 *
 * A group has:
 *
 * * A "layout" vertex array, with fixed attributes, containing values calculated from layout properties.
 * * Zero, one, or two element arrays, with fixed layout, for eventual `gl.drawElements` use.
 * * Zero or more "paint" vertex arrays keyed by layer ID, each with a dynamic layout which depends
 *   on which paint properties of that layer use data-driven-functions (property functions or
 *   property-and-zoom functions). Values are calculated by evaluating those functions.
 *
 * Because indexed rendering is best done with 16 bit indices (and in fact, in WebGL, 16 bit
 * indices are the only choice), a form of segmented addressing is used. Each group
 * contains an `Array` of `Segment`s. A segment contains a vertex array offset, which forms
 * the "base address" of indices within this segment. Each segment is drawn separately.
 *
 * @private
 */
class ArrayGroup {
    constructor(programInterface, programConfigurations) {
        const LayoutVertexArrayType = programInterface.layoutVertexArrayType;
        this.layoutVertexArray = new LayoutVertexArrayType();

        const ElementArrayType = programInterface.elementArrayType;
        if (ElementArrayType) this.elementArray = new ElementArrayType();

        const ElementArrayType2 = programInterface.elementArrayType2;
        if (ElementArrayType2) this.elementArray2 = new ElementArrayType2();

        this.paintVertexArrays = util.mapObject(programConfigurations, (programConfiguration) => {
            const PaintVertexArrayType = programConfiguration.paintVertexArrayType();
            const paintVertexArray = new PaintVertexArrayType();
            paintVertexArray.programConfiguration = programConfiguration;
            return paintVertexArray;
        });

        this.segments = [];
        this.segments2 = [];
    }

    prepareSegment(numVertices) {
        let segment = this.segments[this.segments.length - 1];
        if (!segment || segment.vertexLength + numVertices > ArrayGroup.MAX_VERTEX_ARRAY_LENGTH) {
            segment = new Segment(this.layoutVertexArray.length, this.elementArray.length);
            this.segments.push(segment);
        }
        return segment;
    }

    prepareSegment2(numVertices) {
        let segment = this.segments2[this.segments2.length - 1];
        if (!segment || segment.vertexLength + numVertices > ArrayGroup.MAX_VERTEX_ARRAY_LENGTH) {
            segment = new Segment(this.layoutVertexArray.length, this.elementArray2.length);
            this.segments2.push(segment);
        }
        return segment;
    }

    populatePaintArrays(layers, globalProperties, featureProperties) {
        for (const layer of layers) {
            const paintArray = this.paintVertexArrays[layer.id];
            paintArray.programConfiguration.populatePaintArray(
                layer,
                paintArray,
                this.layoutVertexArray.length,
                globalProperties,
                featureProperties);
        }
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
                return {
                    array: array.serialize(),
                    type: array.constructor.serialize()
                };
            }),
            segments: this.segments,
            segments2: this.segments2
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
