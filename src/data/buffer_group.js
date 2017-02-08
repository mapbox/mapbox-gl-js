'use strict';

const util = require('../util/util');
const Buffer = require('./buffer');
const ProgramConfiguration = require('./program_configuration');
const VertexArrayObject = require('../render/vertex_array_object');

class BufferGroup {
    constructor(programInterface, layers, zoom, arrays) {
        this.layoutVertexBuffer = new Buffer(arrays.layoutVertexArray,
            programInterface.layoutVertexArrayType.serialize(), Buffer.BufferType.VERTEX);

        if (arrays.elementArray) {
            this.elementBuffer = new Buffer(arrays.elementArray,
                programInterface.elementArrayType.serialize(), Buffer.BufferType.ELEMENT);
        }

        if (arrays.elementArray2) {
            this.elementBuffer2 = new Buffer(arrays.elementArray2,
                programInterface.elementArrayType2.serialize(), Buffer.BufferType.ELEMENT);
        }

        this.layerData = {};
        for (const layer of layers) {
            const array = arrays.paintVertexArrays && arrays.paintVertexArrays[layer.id];
            const programConfiguration = ProgramConfiguration.createDynamic(programInterface.paintAttributes || [], layer, zoom);
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
