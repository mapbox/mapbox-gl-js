// @flow

const {ProgramConfigurationSet} = require('./program_configuration');
const createVertexArrayType = require('./vertex_array_type');
const {SegmentVector} = require('./segment');

import type {Segment} from './segment';
import type StyleLayer from '../style/style_layer';
import type {ProgramInterface} from './program_configuration';
import type {
    StructArray,
    SerializedStructArray,
    SerializedStructArrayType
} from '../util/struct_array';

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
    globalProperties: {zoom: number};
    layoutVertexArray: StructArray;
    dynamicLayoutVertexArray: StructArray;
    elementArray: StructArray;
    elementArray2: StructArray;
    programConfigurations: ProgramConfigurationSet;
    segments: SegmentVector;
    segments2: SegmentVector;

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

        this.programConfigurations = new ProgramConfigurationSet(programInterface, layers, zoom);

        this.segments = new SegmentVector();
        this.segments2 = new SegmentVector();
    }

    prepareSegment(numVertices: number): Segment {
        return this.segments.prepareSegment(numVertices, this.layoutVertexArray, this.elementArray);
    }

    prepareSegment2(numVertices: number): Segment {
        return this.segments2.prepareSegment(numVertices, this.layoutVertexArray, this.elementArray2);
    }

    populatePaintArrays(featureProperties: Object) {
        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, featureProperties);
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
            paintVertexArrays: this.programConfigurations.serialize(transferables),
            segments: this.segments.get(),
            segments2: this.segments2.get()
        };
    }
}

module.exports = ArrayGroup;
