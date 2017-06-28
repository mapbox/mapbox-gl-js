// @flow

const util = require('../util/util');
const Buffer = require('./buffer');
const ProgramConfiguration = require('./program_configuration');
const createVertexArrayType = require('./vertex_array_type');
const VertexArrayObject = require('../render/vertex_array_object');

import type StyleLayer from '../style/style_layer';
import type {ProgramInterface} from './program_configuration';
import type {SerializedArrayGroup} from './array_group';
import type {StructArray} from '../util/struct_array';

/**
 * A class containing vertex and element arrays for a bucket, ready for use in
 * a WebGL program.  See {@link ArrayGroup} for details.
 *
 * @private
 */
class BufferGroup {
    layoutVertexBuffer: Buffer;
    dynamicLayoutVertexArray: StructArray;
    dynamicLayoutVertexBuffer: Buffer;
    elementBuffer: Buffer;
    elementBuffer2: Buffer;
    layerData: {[string]: {
        programConfiguration: ProgramConfiguration,
        paintVertexBuffer: ?Buffer
    }};
    segments: Array<any>;
    segments2: Array<any>;

    constructor(programInterface: ProgramInterface, layers: Array<StyleLayer>, zoom: number, arrays: SerializedArrayGroup) {
        const LayoutVertexArrayType = createVertexArrayType(programInterface.layoutAttributes);
        this.layoutVertexBuffer = new Buffer(arrays.layoutVertexArray,
            LayoutVertexArrayType.serialize(), Buffer.BufferType.VERTEX);

        if (arrays.dynamicLayoutVertexArray && programInterface.dynamicLayoutAttributes) {
            const DynamicLayoutVertexArrayType = createVertexArrayType(programInterface.dynamicLayoutAttributes);
            this.dynamicLayoutVertexArray = new DynamicLayoutVertexArrayType(arrays.dynamicLayoutVertexArray);
            this.dynamicLayoutVertexBuffer = new Buffer(arrays.dynamicLayoutVertexArray,
                DynamicLayoutVertexArrayType.serialize(), Buffer.BufferType.VERTEX, true);
        }

        if (arrays.elementArray && programInterface.elementArrayType) {
            this.elementBuffer = new Buffer(arrays.elementArray,
                programInterface.elementArrayType.serialize(), Buffer.BufferType.ELEMENT);
        }

        if (arrays.elementArray2 && programInterface.elementArrayType2) {
            this.elementBuffer2 = new Buffer(arrays.elementArray2,
                programInterface.elementArrayType2.serialize(), Buffer.BufferType.ELEMENT);
        }

        this.layerData = {};
        for (const layer of layers) {
            const array = arrays.paintVertexArrays && arrays.paintVertexArrays[layer.id];
            const programConfiguration = ProgramConfiguration.createDynamic(programInterface, layer, zoom);
            const paintVertexBuffer = array ? new Buffer(array.array, array.type, Buffer.BufferType.VERTEX) : null;
            this.layerData[layer.id] = {programConfiguration, paintVertexBuffer};
        }

        this.segments = arrays.segments;
        this.segments2 = arrays.segments2;

        for (const segments of [this.segments, this.segments2]) {
            for (const segment of segments || []) {
                segment.vaos = util.mapObject(this.layerData, () => new VertexArrayObject());
            }
        }
    }

    destroy() {
        this.layoutVertexBuffer.destroy();

        if (this.dynamicLayoutVertexBuffer) {
            this.dynamicLayoutVertexBuffer.destroy();
        }
        if (this.elementBuffer) {
            this.elementBuffer.destroy();
        }
        if (this.elementBuffer2) {
            this.elementBuffer2.destroy();
        }
        for (const layerId in this.layerData) {
            const paintVertexBuffer = this.layerData[layerId].paintVertexBuffer;
            if (paintVertexBuffer) {
                paintVertexBuffer.destroy();
            }
        }
        for (const segments of [this.segments, this.segments2]) {
            for (const segment of segments || []) {
                for (const k in segment.vaos) {
                    segment.vaos[k].destroy();
                }
            }
        }
    }
}

module.exports = BufferGroup;
