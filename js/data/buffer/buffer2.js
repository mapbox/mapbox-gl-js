'use strict';

// All "sizes" are measured in bytes

var util = require('../../util/util');

// TODO hella documentation
// TODO switch attributes to an array of objects or a single object
// TODO add length property?
// TODO rename "index" to "nextIndex"?
// TODO take a shader at construct time?

function Buffer(type, attributes, buffer) {
    if (buffer) {
        this.arrayBuffer = buffer.arrayBuffer;
        this.size = this.arrayBuffer.byteLength;
        this.index = buffer.index;
        this.refreshArrayBufferViews();
    } else {
        this.index = 0;
        this.resize(Buffer.SIZE_DEFAULT);
    }

    this.type = type;

    // Normalize attribute definitions
    this.elementSize = 0;
    this.attributes = attributes;
    var attributeAlignment = this.type === Buffer.BufferTypes.VERTEX ? Buffer.VERTEX_ATTRIBUTE_ALIGNMENT : null;
    for (var attributeName in this.attributes) {
        var attribute = this.attributes[attributeName];
        attribute.name = attributeName;
        attribute.components = attribute.components || 1;
        attribute.type = Buffer.AttributeTypes[attribute.type || 'UNSIGNED_BYTE'];
        attribute.size = attribute.type.size * attribute.components;
        attribute.offset = this.elementSize;

        this.elementSize = align(attribute.offset + attribute.size, attributeAlignment);
    }
}

Buffer.prototype.add = function(item) {
    if (this.getIndexOffset(this.index + 1) > this.size) {
        this.resize(this.size * 1.5);
    }

    this.set(this.index, item);

    this.index++;
};

Buffer.prototype.set = function(index, item) {
    util.assert(index <= this.index);

    for (var attributeName in item) {
        var value = item[attributeName];
        var attribute = this.attributes[attributeName];

        if (Array.isArray(value)) {
            util.assert(attribute.components === value.length);
            for (var j = 0; j < value.length; j++) {
                this.setAttribute(index, attributeName, j, value[j]);
            }

        } else {
            util.assert(attribute.components === 1);
            this.setAttribute(index, attributeName, 0, value);
        }
    }
};

Buffer.prototype.setAttribute = function(index, attributeName, componentIndex, value) {
    util.assert(index <= this.index);

    var attribute = this.attributes[attributeName];
    var offset = this.getIndexAttributeOffset(index, attributeName, componentIndex) / attribute.type.size;
    var arrayBufferView = this.arrayBufferViews[attribute.type.name];
    arrayBufferView[offset] = value;
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
        // this.arrayBuffer = null;
    } else {
        gl.bindBuffer(type, this.glBuffer);
    }
};

Buffer.prototype.bindVertexAttribute = function(gl, shader, index, attributeName) {
    var attribute = this.attributes[attributeName];
    util.assert(shader['a_' + attribute.name] !== undefined);

    gl.vertexAttribPointer(
        shader['a_' + attribute.name],
        attribute.components,
        gl[attribute.type.name],
        false,
        this.elementSize,
        this.getIndexAttributeOffset(index, attribute.name)
    );
};

Buffer.prototype.resize = function(size) {
    if (this.arrayBuffer) var old = this.arrayBufferViews.UBYTE;

    this.size = align(size, Buffer.SIZE_ALIGNMENT);
    this.arrayBuffer = new ArrayBuffer(this.size);
    this.refreshArrayBufferViews();

    if (old) this.arrayBufferViews.UBYTE.set(old);
};

Buffer.prototype.getIndexOffset = function(index) {
    return index * this.elementSize;
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
    var element = {};
    for (var attributeName in this.attributes) {
        var attribute = this.attributes[attributeName];
        element[attributeName] = [];

        for (var componentIndex = 0; componentIndex < attribute.components; componentIndex++) {
            var offset = this.getIndexAttributeOffset(index, attributeName, componentIndex) / attribute.type.size;
            var arrayBufferView = this.arrayBufferViews[attribute.type.name];
            var value = arrayBufferView[offset];
            element[attributeName][componentIndex] = value;
        }
    }
    return element;
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
Buffer.SIZE_ALIGNMENT = 4;
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
