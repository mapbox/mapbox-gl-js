'use strict';

// All "sizes" are measured in bytes

// TODO hella documentation
// TODO take constructor params as a single options object
// TODO accept a known length from constructor, throw an error if ever resized

var util = require('../util/util');

function Buffer(options) {
    if (options.isMapboxBuffer) {
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

        // Normalize attribute definitions. Attributes may be passed as an object or an array.
        this.itemSize = 0;
        this.attributes = {};
        var attributeAlignment = this.type === Buffer.BufferTypes.VERTEX ? Buffer.VERTEX_ATTRIBUTE_ALIGNMENT : null;
        for (var key in options.attributes) {
            var attribute = options.attributes[key];

            attribute.name = attribute.name || key;
            attribute.components = attribute.components || 1;
            attribute.type = attribute.type || Buffer.AttributeTypes.UNSIGNED_BYTE;

            attribute.size = attribute.type.size * attribute.components;
            attribute.offset = this.itemSize;
            this.itemSize = align(attribute.offset + attribute.size, attributeAlignment);

            this.attributes[attribute.name] = attribute;
        }
    }

    util.assert(this.type);
}

Buffer.prototype.isMapboxBuffer = true;

Buffer.prototype.add = function(item) {
    this.set(this.index++, item);
    return this.index++;
};

// TODO accept a non-object item for single attribute buffers
Buffer.prototype.set = function(index, item) {
    util.assert(index <= this.index);

    if (typeof item === "object" && item !== null && !Array.isArray(item)) {
        for (var attributeName in item) {
           this.setAttribute(index, attributeName, item[attributeName]);
        }

    } else {
        var keys = Object.keys(this.attributes);
        util.assert(keys.length === 1);
        this.setAttribute(index, keys[0], item);
    }

};

Buffer.prototype.setAttribute = function(index, attributeName, value) {
    // TODO insert smarter thing here
    while (this.getIndexOffset(index) > this.size) {
        this.resize(this.size * 1.5);
    }

    util.assert(index <= this.index);
    var attribute = this.attributes[attributeName];
    if (!Array.isArray(value)) value = [value];

    for (var componentIndex = 0; componentIndex < attribute.components; componentIndex++) {
        var offset = this.getIndexAttributeOffset(index, attributeName, componentIndex) / attribute.type.size;
        var arrayBufferView = this.arrayBufferViews[attribute.type.name];
        arrayBufferView[offset] = value;
    }
};

Buffer.prototype.destroy = function(gl) {
    if (this.glBuffer) {
        gl.deleteBuffer(this.glBuffer);
    }
};

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

Buffer.prototype.bindVertexAttribute = function(gl, shaderLocation, index, attributeName) {
    var attribute = this.attributes[attributeName];

    gl.vertexAttribPointer(
        shaderLocation,
        attribute.components,
        gl[attribute.type.name],
        false,
        this.itemSize,
        this.getIndexAttributeOffset(index, attribute.name)
    );
};

Buffer.prototype.resize = function(size) {
    var old = this.arrayBufferViews.UNSIGNED_BYTE;
    this.size = align(size, Buffer.SIZE_ALIGNMENT);
    this.arrayBuffer = new ArrayBuffer(this.size);
    this.refreshArrayBufferViews();
    this.arrayBufferViews.UNSIGNED_BYTE.set(old);
};

Buffer.prototype.getIndexOffset = function(index) {
    return index * this.itemSize;
};

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

Buffer.BufferTypes = {
    VERTEX: 'ARRAY_BUFFER',
    ELEMENT:  'ELEMENT_ARRAY_BUFFER'
};

Buffer.AttributeTypes = {
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
