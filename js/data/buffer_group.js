'use strict';

const util = require('../util/util');
const Buffer = require('./buffer');
const VertexArrayObject = require('../render/vertex_array_object');

module.exports = BufferGroup;

function BufferGroup(arrayGroup, arrayTypes) {
    this.layoutVertexBuffer = new Buffer(arrayGroup.layoutVertexArray,
        arrayTypes.layoutVertexArrayType, Buffer.BufferType.VERTEX);

    if (arrayGroup.elementArray) {
        this.elementBuffer = new Buffer(arrayGroup.elementArray,
            arrayTypes.elementArrayType, Buffer.BufferType.ELEMENT);
    }

    const vaos = this.vaos = {};
    let secondVaos;

    if (arrayGroup.elementArray2) {
        this.elementBuffer2 = new Buffer(arrayGroup.elementArray2,
            arrayTypes.elementArrayType2, Buffer.BufferType.ELEMENT);
        secondVaos = this.secondVaos = {};
    }

    this.paintVertexBuffers = util.mapObject(arrayGroup.paintVertexArrays, (array, name) => {
        vaos[name] = new VertexArrayObject();
        if (arrayGroup.elementArray2) {
            secondVaos[name] = new VertexArrayObject();
        }
        return new Buffer(array, arrayTypes.paintVertexArrayTypes[name], Buffer.BufferType.VERTEX);
    });
}

BufferGroup.prototype.destroy = function() {
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
    for (const j in this.vaos) {
        this.vaos[j].destroy();
    }
    for (const k in this.secondVaos) {
        this.secondVaos[k].destroy();
    }
};
