'use strict';

module.exports = Buffer;

/**
 * The `Buffer` class turns a `StructArray` into a WebGL buffer. Each member of the StructArray's
 * Struct type is converted to a WebGL atribute.
 *
 * @class Buffer
 * @private
 * @param {object} array A serialized StructArray.
 * @param {object} arrayType A serialized StructArrayType.
 * @param {BufferType} type
 */
function Buffer(array, arrayType, type) {
    this.arrayBuffer = array.arrayBuffer;
    this.length = array.length;
    this.attributes = arrayType.members;
    this.itemSize = arrayType.bytesPerElement;
    this.type = type;
}

/**
 * Bind this buffer to a WebGL context.
 * @private
 * @param gl The WebGL context
 */
Buffer.prototype.bind = function(gl) {
    var type = gl[this.type];

    if (!this.buffer) {
        this.buffer = gl.createBuffer();
        gl.bindBuffer(type, this.buffer);
        gl.bufferData(type, this.arrayBuffer, gl.STATIC_DRAW);

        // dump array buffer once it's bound to gl
        this.arrayBuffer = null;
    } else {
        gl.bindBuffer(type, this.buffer);
    }
};

/**
 * Destroy the GL buffer bound to the given WebGL context
 * @private
 * @param gl The WebGL context
 */
Buffer.prototype.destroy = function(gl) {
    if (this.buffer) {
        gl.deleteBuffer(this.buffer);
    }
};

/**
 * @enum {string} BufferAttributeType
 * @private
 * @readonly
 */
var AttributeType = {
    Int8:   'BYTE',
    Uint8:  'UNSIGNED_BYTE',
    Int16:  'SHORT',
    Uint16: 'UNSIGNED_SHORT'
};

/**
 * Set the attribute pointers in a WebGL context according to the buffer's attribute layout
 * @private
 * @param gl The WebGL context
 * @param program The active WebGL program
 * @param {number} offset The offset of the attribute data in the currently bound GL buffer.
 */
Buffer.prototype.setAttribPointers = function(gl, program, offset) {
    for (var i = 0; i < this.attributes.length; i++) {
        var attrib = this.attributes[i];

        gl.vertexAttribPointer(
            program['a_' + attrib.name],
            attrib.components,
            gl[AttributeType[attrib.type]],
            false,
            this.itemSize,
            offset + attrib.offset
        );
    }
};

/**
 * @enum {string} BufferType
 * @private
 * @readonly
 */
Buffer.BufferType = {
    VERTEX: 'ARRAY_BUFFER',
    ELEMENT: 'ELEMENT_ARRAY_BUFFER'
};

/**
 * An `BufferType.ELEMENT` buffer holds indicies of a corresponding `BufferType.VERTEX` buffer.
 * These indicies are stored in the `BufferType.ELEMENT` buffer as `UNSIGNED_SHORT`s.
 *
 * @private
 * @readonly
 */
Buffer.ELEMENT_ATTRIBUTE_TYPE = 'Uint16';

/**
 * WebGL performs best if vertex attribute offsets are aligned to 4 byte boundaries.
 * @private
 * @readonly
 */
Buffer.VERTEX_ATTRIBUTE_ALIGNMENT = 4;
