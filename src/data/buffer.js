// @flow

import type {
    StructArray,
    StructArrayMember,
    SerializedStructArray,
    SerializedStructArrayType
} from '../util/struct_array';

import type {Program} from './program_configuration';

/**
 * @enum {string} AttributeType
 * @private
 * @readonly
 */
const AttributeType = {
    Int8:   'BYTE',
    Uint8:  'UNSIGNED_BYTE',
    Int16:  'SHORT',
    Uint16: 'UNSIGNED_SHORT',
    Int32:  'INT',
    Uint32: 'UNSIGNED_INT',
    Float32: 'FLOAT'
};

/**
 * The `Buffer` class turns a `StructArray` into a WebGL buffer. Each member of the StructArray's
 * Struct type is converted to a WebGL atribute.
 * @private
 */
class Buffer {
    static BufferType: {[string]: 'ARRAY_BUFFER' | 'ELEMENT_ARRAY_BUFFER'};
    arrayBuffer: ?ArrayBuffer;
    length: number;
    attributes: Array<StructArrayMember>;
    itemSize: number;
    type: 'ARRAY_BUFFER' | 'ELEMENT_ARRAY_BUFFER';
    arrayType: SerializedStructArrayType;
    dynamicDraw: ?boolean;
    gl: WebGLRenderingContext;
    buffer: ?WebGLBuffer;

    /**
     * @param {Object} array A serialized StructArray.
     * @param {Object} arrayType A serialized StructArrayType.
     * @param {BufferType} type
     * @param {boolean} dynamicDraw Whether this buffer will be repeatedly updated.
     */
    constructor(array: SerializedStructArray,
                arrayType: SerializedStructArrayType,
                type: 'ARRAY_BUFFER' | 'ELEMENT_ARRAY_BUFFER',
                dynamicDraw?: boolean) {
        this.arrayBuffer = array.arrayBuffer;
        this.length = array.length;
        this.attributes = arrayType.members;
        this.itemSize = arrayType.bytesPerElement;
        this.type = type;
        this.arrayType = arrayType;
        this.dynamicDraw = dynamicDraw;
    }

    static fromStructArray(array: StructArray, type: 'ARRAY_BUFFER' | 'ELEMENT_ARRAY_BUFFER') {
        return new Buffer(array.serialize(), array.constructor.serialize(), type);
    }

    /**
     * Bind this buffer to a WebGL context.
     * @param gl The WebGL context
     */
    bind(gl: WebGLRenderingContext) {
        const type: number = (gl : any)[this.type];

        if (!this.buffer) {
            this.gl = gl;
            this.buffer = gl.createBuffer();
            gl.bindBuffer(type, this.buffer);
            gl.bufferData(type, this.arrayBuffer, this.dynamicDraw ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);

            // dump array buffer once it's bound to gl
            this.arrayBuffer = null;
        } else {
            gl.bindBuffer(type, this.buffer);

            if (this.dynamicDraw && this.arrayBuffer) {
                gl.bufferSubData(type, 0, this.arrayBuffer);
                this.arrayBuffer = null;
            }
        }
    }

    updateData(array: SerializedStructArray) {
        this.arrayBuffer = array.arrayBuffer;
    }

    enableAttributes(gl: WebGLRenderingContext, program: Program) {
        for (let j = 0; j < this.attributes.length; j++) {
            const member = this.attributes[j];
            const attribIndex: number | void = program[member.name];
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
    setVertexAttribPointers(gl: WebGLRenderingContext, program: Program, vertexOffset: number) {
        for (let j = 0; j < this.attributes.length; j++) {
            const member = this.attributes[j];
            const attribIndex: number | void = program[member.name];

            if (attribIndex !== undefined) {
                gl.vertexAttribPointer(
                    attribIndex,
                    member.components,
                    (gl : any)[AttributeType[member.type]],
                    false,
                    this.arrayType.bytesPerElement,
                    member.offset + (this.arrayType.bytesPerElement * vertexOffset || 0)
                );
            }
        }
    }

    /**
     * Destroy the GL buffer bound to the given WebGL context
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
