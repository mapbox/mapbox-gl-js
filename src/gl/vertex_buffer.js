// @flow

import type {
    StructArray,
    StructArrayMember,
    SerializedStructArray
} from '../util/struct_array';

import type Program from '../render/program';

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
 * The `VertexBuffer` class turns a `StructArray` into a WebGL buffer. Each member of the StructArray's
 * Struct type is converted to a WebGL atribute.
 * @private
 */
class VertexBuffer {
    length: number;
    attributes: Array<StructArrayMember>;
    itemSize: number;
    dynamicDraw: ?boolean;
    gl: WebGLRenderingContext;
    buffer: WebGLBuffer;

    /**
     * @param dynamicDraw Whether this buffer will be repeatedly updated.
     */
    constructor(gl: WebGLRenderingContext, array: StructArray, dynamicDraw?: boolean) {
        this.length = array.length;
        this.attributes = array.members;
        this.itemSize = array.bytesPerElement;
        this.dynamicDraw = dynamicDraw;

        this.gl = gl;
        this.buffer = gl.createBuffer();
        this.gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        this.gl.bufferData(gl.ARRAY_BUFFER, array.arrayBuffer, this.dynamicDraw ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);

        if (!this.dynamicDraw) {
            delete array.arrayBuffer;
        }
    }

    bind() {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    }

    updateData(array: SerializedStructArray) {
        this.bind();
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, array.arrayBuffer);
    }

    enableAttributes(gl: WebGLRenderingContext, program: Program) {
        for (let j = 0; j < this.attributes.length; j++) {
            const member = this.attributes[j];
            const attribIndex: number | void = program.attributes[member.name];
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
    setVertexAttribPointers(gl: WebGLRenderingContext, program: Program, vertexOffset: ?number) {
        for (let j = 0; j < this.attributes.length; j++) {
            const member = this.attributes[j];
            const attribIndex: number | void = program.attributes[member.name];

            if (attribIndex !== undefined) {
                gl.vertexAttribPointer(
                    attribIndex,
                    member.components,
                    (gl: any)[AttributeType[member.type]],
                    false,
                    this.itemSize,
                    member.offset + (this.itemSize * (vertexOffset || 0))
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
            delete this.buffer;
        }
    }
}

module.exports = VertexBuffer;
