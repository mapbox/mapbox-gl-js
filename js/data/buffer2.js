'use strict';

// All "sizes" are measured in bytes

var util = require('../util/util');

/**
 * The `Buffer` class is responsible for managing one ArrayBuffer, which may contain one or more
 * "attributes" per "item". `Buffer`s are created and populated by `Bucket`s.
 *
 * @class Buffer
 * @namespace Bucket
 * @private
 * @param options Configuration for the buffer or a serialized buffer.
 * @param {Buffer.BufferType} options.type
 * @param {Buffer.Attribute} options.attributes
 */
function Buffer(options) {
    if (options.isSerializedMapboxBuffer) {
        var clone = options;
        this.type = clone.type;
        this.attributes = clone.attributes;
        this.itemSize = clone.itemSize;
        this.size = clone.size;
        this.index = clone.index;
        this.arrayBuffer = clone.arrayBuffer;

        this.refreshArrayBufferViews();

    } else {
        this.type = options.type;
        this.size = align(Buffer.SIZE_DEFAULT, Buffer.SIZE_ALIGNMENT);
        this.index = 0;
        this.arrayBuffer = new ArrayBuffer(this.size);
        this.refreshArrayBufferViews();

        // Normalize attribute definitions.
        // Attributes may be passed as an object or an array.
        this.attributes = {};
        this.itemSize = 0;
        var attributeAlignment = (this.type === Buffer.BufferType.VERTEX) ? Buffer.VERTEX_ATTRIBUTE_ALIGNMENT : null;
        for (var key in options.attributes) {
            var attribute = options.attributes[key];

            attribute.name = attribute.name || key;
            attribute.components = attribute.components || 1;
            attribute.type = attribute.type || Buffer.AttributeType.UNSIGNED_BYTE;
            attribute.size = attribute.type.size * attribute.components;
            attribute.offset = this.itemSize;
            this.itemSize = align(attribute.offset + attribute.size, attributeAlignment);

            this.attributes[attribute.name] = attribute;
        }

        // Enable some special behaviour there is only one attribute on the `Buffer`.
        var attributeNames = Object.keys(this.attributes);
        if (attributeNames.length === 1) {
            this.isSingleAttributeBuffer = true;
            this.singleAttribute = this.attributes[attributeNames[0]];
        } else {
            this.isSingleAttributeBuffer = false;
        }
    }

    util.assert(this.type);
}

/**
 * Add an item to the end of the buffer.
 */
Buffer.prototype.add = function(item) {
    this.set(this.index++, item);
    return this.index;
};

/**
 * Set an item at a particuar index within the buffer
 */
Buffer.prototype.set = function(index, item) {
    if (typeof item === "object" && item !== null && !Array.isArray(item)) {
        for (var attributeName in item) {
           this.setAttribute(index, attributeName, item[attributeName]);
        }
    } else {
        util.assert(this.isSingleAttributeBuffer);
        this.setAttribute(index, this.singleAttribute.name, item);
    }
};

/**
 * Set an attribute for an item at a particuar index within the buffer
 */
Buffer.prototype.setAttribute = function(index, attributeName, value) {
    if (this.getIndexOffset(index + 1) > this.size) {
        this.resize(this.size * 1.5);
    }
    util.assert(this.getIndexOffset(index + 1) <= this.size);

    var attribute = this.attributes[attributeName];
    if (!Array.isArray(value)) value = [value];

    for (var componentIndex = 0; componentIndex < attribute.components; componentIndex++) {
        var offset = this.getIndexAttributeOffset(index, attributeName, componentIndex) / attribute.type.size;
        var arrayBufferView = this.arrayBufferViews[attribute.type.name];
        arrayBufferView[offset] = value[componentIndex];
    }
};

/**
 * Bind this buffer to a GL context
 */
Buffer.prototype.bind = function(gl) {
    var type = gl[this.type];

    if (!this.glBuffer) {
        this.glBuffer = gl.createBuffer();
        gl.bindBuffer(type, this.glBuffer);
        gl.bufferData(type, this.arrayBuffer.slice(0, this.size), gl.STATIC_DRAW);
        this.arrayBuffer = null;
    } else {
        gl.bindBuffer(type, this.glBuffer);
    }
};

/**
 * Bind a vertex attribute in this buffer to a shader location on a GL context
 *
 * @param gl
 * @param {number} shaderLocation
 * @param {number} startIndex
 * @param {string} attributeName
 */
Buffer.prototype.bindVertexAttribute = function(gl, shaderLocation, startIndex, attributeName) {
    var attribute = this.attributes[attributeName];

    gl.vertexAttribPointer(
        shaderLocation,
        attribute.components,
        gl[attribute.type.name],
        false,
        this.itemSize,
        this.getIndexAttributeOffset(startIndex, attribute.name)
    );
};

/**
 * Unbind this buffer from a GL context
 */
Buffer.prototype.destroy = function(gl) {
    if (this.glBuffer) {
        gl.deleteBuffer(this.glBuffer);
    }
};

/**
 * Resize the underlying `ArrayBuffer`
 *
 * @param {number} size The desired size of the `ArrayBuffer`, in bytes
 */
Buffer.prototype.resize = function(size) {
    var old = this.arrayBufferViews.UNSIGNED_BYTE;
    this.size = align(size, Buffer.SIZE_ALIGNMENT);
    this.arrayBuffer = new ArrayBuffer(this.size);
    this.refreshArrayBufferViews();
    this.arrayBufferViews.UNSIGNED_BYTE.set(old);
};

/**
 * Get the byte offset of a particular item index
 */
Buffer.prototype.getIndexOffset = function(index) {
    return index * this.itemSize;
};

/**
 * Get the byte offset of an attribute at a particular item index
 */
Buffer.prototype.getIndexAttributeOffset = function(index, attributeName, componentIndex) {
    var attribute = this.attributes[attributeName];
    return (
        this.getIndexOffset(index) +
        attribute.offset +
        attribute.type.size * (componentIndex || 0)
    );
};

Buffer.prototype.refreshArrayBufferViews = function() {
    this.arrayBufferViews = {
        UNSIGNED_BYTE:  new Uint8Array(this.arrayBuffer),
        BYTE:           new Int8Array(this.arrayBuffer),
        UNSIGNED_SHORT: new Uint16Array(this.arrayBuffer),
        SHORT:          new Int16Array(this.arrayBuffer)
    };
};

/**
 * Get the item at a particular index from the ArrayBuffer.
 */
Buffer.prototype.get = function(index) {
    var item = {};
    for (var attributeName in this.attributes) {
        var attribute = this.attributes[attributeName];
        item[attributeName] = [];

        for (var componentIndex = 0; componentIndex < attribute.components; componentIndex++) {
            var offset = this.getIndexAttributeOffset(index, attributeName, componentIndex) / attribute.type.size;
            var arrayBufferView = this.arrayBufferViews[attribute.type.name];
            var value = arrayBufferView[offset];
            item[attributeName][componentIndex] = value;
        }
    }
    return item;
};

// TODO combine serialize and getTransferrables method, destroy the local copy once ownership
// is presumed transferred.

/**
 * Serialize the buffer to be transferred between the worker thread and the main thread.
 */
Buffer.prototype.serialize = function(item) {
    return {
        type: this.type,
        attributes: this.attributes,
        itemSize: this.itemSize,
        size: this.size,
        index: this.index,
        arrayBuffer: this.arrayBuffer,
        isSerializedMapboxBuffer: true
    }
};

/**
 * @returns An array of objects that should have their ownership transferred instead of copied
 * when this buffer is serialized and set to the main thread. Transferring owernship is much faster
 * than copying.
 */
Buffer.prototype.getTransferrables = function() {
    return [this.arrayBuffer];
};

Buffer.prototype.isMapboxBuffer = true;

Buffer.BufferType = {
    VERTEX: 'ARRAY_BUFFER',
    ELEMENT:  'ELEMENT_ARRAY_BUFFER'
};

Buffer.AttributeType = {
    BYTE:           { size: 1, name: 'BYTE' },
    UNSIGNED_BYTE:  { size: 1, name: 'UNSIGNED_BYTE' },
    SHORT:          { size: 2, name: 'SHORT' },
    UNSIGNED_SHORT: { size: 2, name: 'UNSIGNED_SHORT' }
};

Buffer.SIZE_DEFAULT = 8192;

Buffer.SIZE_ALIGNMENT = 2;

Buffer.VERTEX_ATTRIBUTE_ALIGNMENT = 4;

function align(value, alignment) {
    alignment = alignment || 1;
    var remainder = value % alignment;
    if (alignment !== 1 && remainder !== 0) {
        value += (alignment - remainder);
    }
    return value;
}

module.exports = Buffer;
