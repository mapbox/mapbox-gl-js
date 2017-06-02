'use strict';

/**
 * @enum {string} AttributeType
 * @private
 * @readonly
 */
const AttributeType = {
    Int8:   'BYTE',
    Uint8:  'UNSIGNED_BYTE',
    Int16:  'SHORT',
    Uint16: 'UNSIGNED_SHORT'
};

/**
 * The `Buffer` class turns a `StructArray` into a WebGL buffer. Each member of the StructArray's
 * Struct type is converted to a WebGL atribute.
 * @private
 */
class Buffer {
    /**
     * @param {Object} array A serialized StructArray.
     * @param {Object} arrayType A serialized StructArrayType.
     * @param {BufferType} type
     */
    constructor(array, arrayType, type) {
        this.arrayBuffer = array.arrayBuffer;
        this.length = array.length;
        this.attributes = arrayType.members;
        this.itemSize = arrayType.bytesPerElement;
        this.type = type;
        this.arrayType = arrayType;
    }

    static fromStructArray(array, type) {
        return new Buffer(array.serialize(), array.constructor.serialize(), type);
    }

    /**
     * Bind this buffer to a WebGL context.
     * @param gl The WebGL context
     */
    bind(gl) {
        const type = gl[this.type];

        if (!this.buffer) {
            this.gl = gl;
            this.buffer = gl.createBuffer();
            gl.bindBuffer(type, this.buffer);
            gl.bufferData(type, this.arrayBuffer, gl.STATIC_DRAW);

            // dump array buffer once it's bound to gl
            this.arrayBuffer = null;
        } else {
            gl.bindBuffer(type, this.buffer);
        }
    }

    enableAttributes (gl, program) {
        for (let j = 0; j < this.attributes.length; j++) {
            const member = this.attributes[j];
            const attribIndex = program[member.name];
            if (attribIndex !== undefined) {
                gl.enableVertexAttribArray(attribIndex);
            }
        }
    }

    /**
     * Set the attribute pointers in a WebGL context
     * @param gl The WebGL context
     * @param program The active WebGL program
     * @param vertexOffset Index of the starting vertex of the segment
     */
    setVertexAttribPointers(gl, program, vertexOffset) {
        for (let j = 0; j < this.attributes.length; j++) {
            const member = this.attributes[j];
            const attribIndex = program[member.name];

            if (attribIndex !== undefined) {
                gl.vertexAttribPointer(
                    attribIndex,
                    member.components,
                    gl[AttributeType[member.type]],
                    false,
                    this.arrayType.bytesPerElement,
                    member.offset + (this.arrayType.bytesPerElement * vertexOffset || 0)
                );
            }
        }
    }

    /**
     * Destroy the GL buffer bound to the given WebGL context
     * @param gl The WebGL context
     */
    destroy() {
        if (this.buffer) {
            this.gl.deleteBuffer(this.buffer);
        }
    }
}

/**
 * @enum {string} BufferType
 * @private
 * @readonly
 */
Buffer.BufferType = {
    VERTEX: 'ARRAY_BUFFER',
    ELEMENT: 'ELEMENT_ARRAY_BUFFER'
};

module.exports = Buffer;
