// @flow

const ProgramConfiguration = require('./program_configuration');
const createVertexArrayType = require('./vertex_array_type');

import type StyleLayer from '../style/style_layer';
import type {ProgramInterface} from './program_configuration';
import type {
    StructArray,
    SerializedStructArray,
    SerializedStructArrayType
} from '../util/struct_array';

class Segment {
    vertexOffset: number;
    primitiveOffset: number;
    vertexLength: number;
    primitiveLength: number;

    constructor(vertexOffset: number, primitiveOffset: number) {
        this.vertexOffset = vertexOffset;
        this.primitiveOffset = primitiveOffset;
        this.vertexLength = 0;
        this.primitiveLength = 0;
    }
}

export type {Segment as Segment};

export type SerializedArrayGroup = {
    layoutVertexArray: SerializedStructArray,
    dynamicLayoutVertexArray: SerializedStructArray,
    elementArray: SerializedStructArray,
    elementArray2: SerializedStructArray,
    paintVertexArrays: {[string]: {
        array: SerializedStructArray,
        type: SerializedStructArrayType
    }},
    segments: Array<Object>,
    segments2: Array<Object>
}

/**
 * A class that manages vertex and element arrays for a bucket. It handles initialization,
 * serialization for transfer to the main thread, and certain intervening mutations.
 *
 * A group has:
 *
 * * A "layout" vertex array, with fixed attributes, containing values calculated from layout properties.
 * * Zero or one dynamic "layout" vertex arrays, with fixed attributes containing values that can be
 * * recalculated each frame on the cpu.
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
    static MAX_VERTEX_ARRAY_LENGTH: number;

    globalProperties: {zoom: number};
    layoutVertexArray: StructArray;
    dynamicLayoutVertexArray: StructArray;
    elementArray: StructArray;
    elementArray2: StructArray;
    programConfigurations: {[string]: ProgramConfiguration};
    segments: Array<Segment>;
    segments2: Array<Segment>;

    constructor(programInterface: ProgramInterface, layers: Array<StyleLayer>, zoom: number) {
        this.globalProperties = {zoom};

        const LayoutVertexArrayType = createVertexArrayType(programInterface.layoutAttributes);
        this.layoutVertexArray = new LayoutVertexArrayType();

        if (programInterface.dynamicLayoutAttributes) {
            const DynamicLayoutVertexArrayType = createVertexArrayType(programInterface.dynamicLayoutAttributes);
            this.dynamicLayoutVertexArray = new DynamicLayoutVertexArrayType();
        }

        const ElementArrayType = programInterface.elementArrayType;
        if (ElementArrayType) this.elementArray = new ElementArrayType();

        const ElementArrayType2 = programInterface.elementArrayType2;
        if (ElementArrayType2) this.elementArray2 = new ElementArrayType2();

        this.programConfigurations = {};
        for (const layer of layers) {
            const programConfiguration = ProgramConfiguration.createDynamic(programInterface, layer, zoom);
            programConfiguration.paintVertexArray = new programConfiguration.PaintVertexArray();
            programConfiguration.paintPropertyStatistics = programConfiguration.createPaintPropertyStatistics();
            this.programConfigurations[layer.id] = programConfiguration;
        }

        this.segments = [];
        this.segments2 = [];
    }

    prepareSegment(numVertices: number): Segment {
        let segment = this.segments[this.segments.length - 1];
        if (!segment || segment.vertexLength + numVertices > ArrayGroup.MAX_VERTEX_ARRAY_LENGTH) {
            segment = new Segment(this.layoutVertexArray.length, this.elementArray.length);
            this.segments.push(segment);
        }
        return segment;
    }

    prepareSegment2(numVertices: number): Segment {
        let segment = this.segments2[this.segments2.length - 1];
        if (!segment || segment.vertexLength + numVertices > ArrayGroup.MAX_VERTEX_ARRAY_LENGTH) {
            segment = new Segment(this.layoutVertexArray.length, this.elementArray2.length);
            this.segments2.push(segment);
        }
        return segment;
    }

    populatePaintArrays(featureProperties: Object) {
        for (const key in this.programConfigurations) {
            this.programConfigurations[key].populatePaintArray(
                this.layoutVertexArray.length,
                featureProperties);
        }
    }

    isEmpty() {
        return this.layoutVertexArray.length === 0;
    }

    serialize(transferables?: Array<Transferable>): SerializedArrayGroup {
        return {
            layoutVertexArray: this.layoutVertexArray.serialize(transferables),
            dynamicLayoutVertexArray: this.dynamicLayoutVertexArray && this.dynamicLayoutVertexArray.serialize(transferables),
            elementArray: this.elementArray && this.elementArray.serialize(transferables),
            elementArray2: this.elementArray2 && this.elementArray2.serialize(transferables),
            paintVertexArrays: serializePaintVertexArrays(this.programConfigurations, transferables),
            segments: this.segments,
            segments2: this.segments2
        };
    }
}

function serializePaintVertexArrays(programConfigurations: {[string]: ProgramConfiguration}, transferables?: Array<Transferable>) {
    const paintVertexArrays = {};
    for (const layerId in programConfigurations) {
        const serialized = programConfigurations[layerId].serialize(transferables);
        if (!serialized) continue;
        paintVertexArrays[layerId] = serialized;
    }
    return paintVertexArrays;
}

/**
 * The maximum size of a vertex array. This limit is imposed by WebGL's 16 bit
 * addressing of vertex buffers.
 * @private
 * @readonly
 */
ArrayGroup.MAX_VERTEX_ARRAY_LENGTH = Math.pow(2, 16) - 1;

module.exports = ArrayGroup;
