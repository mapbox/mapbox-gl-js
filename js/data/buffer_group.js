'use strict';

const util = require('../util/util');
const Buffer = require('./buffer');
const VertexArrayObject = require('../render/vertex_array_object');

class BufferGroup {

    constructor(arrayGroup, programInterface) {
        this.layoutVertexBuffer = new Buffer(arrayGroup.layoutVertexArray,
            programInterface.layoutVertexArrayType.serialize(), Buffer.BufferType.VERTEX);

        if (arrayGroup.elementArray) {
            this.elementBuffer = new Buffer(arrayGroup.elementArray,
                programInterface.elementArrayType.serialize(), Buffer.BufferType.ELEMENT);
        }

        if (arrayGroup.elementArray2) {
            this.elementBuffer2 = new Buffer(arrayGroup.elementArray2,
                programInterface.elementArrayType2.serialize(), Buffer.BufferType.ELEMENT);
        }

        this.paintVertexBuffers = util.mapObject(arrayGroup.paintVertexArrays, (array) => {
            return new Buffer(array.array, array.type, Buffer.BufferType.VERTEX);
        });

        this.segments = arrayGroup.segments;
        this.segments2 = arrayGroup.segments2;

        for (const segments of [this.segments, this.segments2]) {
            for (const segment of segments || []) {
                segment.vaos = util.mapObject(arrayGroup.paintVertexArrays, () => {
                    return new VertexArrayObject();
                });
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
        for (const n in this.paintVertexBuffers) {
            this.paintVertexBuffers[n].destroy();
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
