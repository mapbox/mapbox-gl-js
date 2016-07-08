'use strict';

var util = require('../util/util');
var Buffer = require('./buffer');
var VertexArrayObject = require('../render/vertex_array_object');

module.exports = BufferGroup;

function BufferGroup(arrayGroup, arrayTypes) {
    this.layoutVertexBuffer = new Buffer(arrayGroup.layoutVertexArray,
        arrayTypes.layoutVertexArrayType, Buffer.BufferType.VERTEX);

    if (arrayGroup.elementArray) {
        this.elementBuffer = new Buffer(arrayGroup.elementArray,
            arrayTypes.elementArrayType, Buffer.BufferType.ELEMENT);
    }

    var vaos = this.vaos = {};
    var secondVaos;

    if (arrayGroup.elementArray2) {
        this.elementBuffer2 = new Buffer(arrayGroup.elementArray2,
            arrayTypes.elementArrayType2, Buffer.BufferType.ELEMENT);
        secondVaos = this.secondVaos = {};
    }

    this.paintVertexBuffers = util.mapObject(arrayGroup.paintVertexArrays, function(array, name) {
        vaos[name] = new VertexArrayObject();
        if (arrayGroup.elementArray2) {
            secondVaos[name] = new VertexArrayObject();
        }
        return new Buffer(array, arrayTypes.paintVertexArrayTypes[name], Buffer.BufferType.VERTEX);
    });
}

BufferGroup.prototype.destroy = function(gl) {
    this.layoutVertexBuffer.destroy(gl);
    if (this.elementBuffer) {
        this.elementBuffer.destroy(gl);
    }
    if (this.elementBuffer2) {
        this.elementBuffer2.destroy(gl);
    }
    for (var n in this.paintVertexBuffers) {
        this.paintVertexBuffers[n].destroy(gl);
    }
    for (var j in this.vaos) {
        this.vaos[j].destroy(gl);
    }
    for (var k in this.secondVaos) {
        this.secondVaos[k].destroy(gl);
    }
};
