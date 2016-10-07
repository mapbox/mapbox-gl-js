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
    this.arrayType = arrayType;
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
 * @enum {string} BufferType
 * @private
 * @readonly
 */
Buffer.BufferType = {
    VERTEX: 'ARRAY_BUFFER',
    ELEMENT: 'ELEMENT_ARRAY_BUFFER'
};
