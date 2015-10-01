'use strict';

// Note: all "sizes" are measured in bytes

var util = require('../util/util');

/**
 * The `Buffer` class is responsible for managing one instance of `ArrayBuffer`. `ArrayBuffer`s
 * provide low-level read/write access to a chunk of memory. `ArrayBuffer`s are populated with
 * per-vertex data, uploaded to the GPU, and used in rendering.
 *
 * `Buffer` provides an abstraction over `ArrayBuffer`, making it behave like an array of
 * statically typed structs. A buffer is comprised of items. An item is comprised of a set of
 * attributes. Attributes are defined when the class is constructed.
 *
 * @class Buffer
 * @private
 * @param options
 * @param {BufferType} options.type
 * @param {Array.<BufferAttribute>} options.attributes
 */
function Buffer(options) {

    this.type = options.type;

    // Clone an existing Buffer
    if (options.arrayBuffer) {

        this.capacity = options.capacity;
        this.arrayBuffer = options.arrayBuffer;
        this.attributes = options.attributes;
        this.itemSize = options.itemSize;
        this.length = options.length;

    // Create a new Buffer
    } else {

        this.capacity = align(Buffer.CAPACITY_DEFAULT, Buffer.CAPACITY_ALIGNMENT);
        this.arrayBuffer = new ArrayBuffer(this.capacity);
        this.attributes = [];
        this.itemSize = 0;
        this.length = 0;

        // Vertex buffer attributes must be aligned to word boundaries but
        // element buffer attributes do not need to be aligned.
        var attributeAlignment = this.type === Buffer.BufferType.VERTEX ? Buffer.VERTEX_ATTRIBUTE_ALIGNMENT : 1;

        for (var i = 0; i < options.attributes.length; i++) {
            var attribute = util.extend({}, options.attributes[i]);
            this.attributes.push(attribute);

            attribute.name = attribute.name;
            attribute.components = attribute.components || 1;
            attribute.type = attribute.type || Buffer.AttributeType.UNSIGNED_BYTE;
            attribute.size = attribute.type.size * attribute.components;
            attribute.offset = this.itemSize;

            this.itemSize = align(attribute.offset + attribute.size, attributeAlignment);
        }
    }

    this._refreshViews();
    this._createPushMethod();
}

// Start Buffer1 compatability code

Buffer.prototype = {
    // binds the buffer to a webgl context
    bind: function(gl) {
        var type = gl[this.type];
        if (!this.buffer) {
            this.buffer = gl.createBuffer();
            gl.bindBuffer(type, this.buffer);
            gl.bufferData(type, this.arrayBuffer.slice(0, this.length * this.itemSize), gl.STATIC_DRAW);

            // dump array buffer once it's bound to gl
            this.arrayBuffer = null;
        } else {
            gl.bindBuffer(type, this.buffer);
        }
    },

    destroy: function(gl) {
        if (this.buffer) {
            gl.deleteBuffer(this.buffer);
        }
    }
};
// End Buffer1 compatability code

/**
 * Get an item from the `ArrayBuffer`.
 * @private
 * @param {number} index The index of the item to get
 * @returns {Object.<string, Array.<number>>}
 */
Buffer.prototype.get = function(index) {
    var item = {};
    for (var i = 0; i < this.attributes.length; i++) {
        var attribute = this.attributes[i];
        item[attribute.name] = [];

        for (var j = 0; j < attribute.components; j++) {
            var offset = this.getOffset(index, i, j) / attribute.type.size;
            var view = this.views[attribute.type.name];
            var value = view[offset];
            item[attribute.name][j] = value;
        }
    }
    return item;
};

/**
 * Get the byte offset of a location in the array buffer.
 * @private
 * @param {number} index
 * @param {number} [attributeIndex]
 * @param {number} [componentIndex]
 */
Buffer.prototype.getOffset = function(index, attributeIndex, componentIndex) {
    if (attributeIndex === undefined) {
        return index * this.itemSize;
    } else {
        var attribute = this.attributes[attributeIndex];
        return (
            index * this.itemSize +
            attribute.offset +
            attribute.type.size * (componentIndex || 0)
        );
    }
};

Buffer.prototype._resize = function(capacity) {
    var old = this.views.UNSIGNED_BYTE;
    this.capacity = align(capacity, Buffer.CAPACITY_ALIGNMENT);
    this.arrayBuffer = new ArrayBuffer(this.capacity);
    this._refreshViews();
    this.views.UNSIGNED_BYTE.set(old);
};

Buffer.prototype._refreshViews = function() {
    this.views = {
        UNSIGNED_BYTE:  new Uint8Array(this.arrayBuffer),
        BYTE:           new Int8Array(this.arrayBuffer),
        UNSIGNED_SHORT: new Uint16Array(this.arrayBuffer),
        SHORT:          new Int16Array(this.arrayBuffer)
    };
};

Buffer.prototype._createPushMethod = function() {
    var body = '';
    var argNames = [];

    body += 'var index = this.length++;\n';
    body += 'var offset = index * ' + checkNumber(this.itemSize) + ';\n';
    body += 'if (offset + ' + checkNumber(this.itemSize) + ' > this.capacity) { this._resize(this.capacity * 1.5); }\n';

    for (var i = 0; i < this.attributes.length; i++) {
        var attribute = this.attributes[i];
        var attributeOffsetIdentifier = 'offset' + i;

        body += '\nvar ' + attributeOffsetIdentifier + ' = (offset + ' + checkNumber(attribute.offset) + ') / ' + checkNumber(attribute.type.size) + ';\n';

        for (var j = 0; j < attribute.components; j++) {
            var componentValueIdentifier = 'value' + i + '_' + j;

            var lvalue = 'this.views.' + checkAttributeTypeName(attribute.type.name) + '[' + attributeOffsetIdentifier + ' + ' + checkNumber(j) + ']';
            var rvalue = componentValueIdentifier;
            body += lvalue + ' = ' + rvalue + ';\n';

            argNames.push(componentValueIdentifier);
        }
    }

    body += '\nreturn index;\n';

    this.push = new Function(argNames, body);
};

/**
 * @typedef BufferAttribute
 * @private
 * @property {string} name
 * @property {number} components
 * @property {BufferAttributeType} type
 * @property {number} size
 * @property {number} offset
 */

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
 * @enum {{size: number, name: string}} BufferAttributeType
 * @private
 * @readonly
 */
Buffer.AttributeType = {
    BYTE:           { size: 1, name: 'BYTE' },
    UNSIGNED_BYTE:  { size: 1, name: 'UNSIGNED_BYTE' },
    SHORT:          { size: 2, name: 'SHORT' },
    UNSIGNED_SHORT: { size: 2, name: 'UNSIGNED_SHORT' }
};

/**
 * An `BufferType.ELEMENT` buffer holds indicies of a corresponding `BufferType.VERTEX` buffer.
 * These indicies are stored in the `BufferType.ELEMENT` buffer as `UNSIGNED_SHORT`s.
 *
 * @property {BufferAttributeType}
 * @private
 * @readonly
 */
Buffer.ELEMENT_ATTRIBUTE_TYPE = Buffer.AttributeType.UNSIGNED_SHORT;

/**
 * @property {number}
 * @private
 * @readonly
 */
Buffer.CAPACITY_DEFAULT = 8192;

/**
 * WebGL performs best if buffer sizes are aligned to 2 byte boundaries.
 * @property {number}
 * @private
 * @readonly
 */
Buffer.CAPACITY_ALIGNMENT = 2;

/**
 * WebGL performs best if vertex attribute offsets are aligned to 4 byte boundaries.
 * @property {number}
 * @private
 * @readonly
 */
Buffer.VERTEX_ATTRIBUTE_ALIGNMENT = 4;

function align(value, alignment) {
    alignment = alignment || 1;
    var remainder = value % alignment;
    if (alignment !== 1 && remainder !== 0) {
        value += (alignment - remainder);
    }
    return value;
}

function checkNumber(input) {
    if (!isNaN(parseFloat(input)) && isFinite(input)) {
        return input;
    } else {
        throw new Error('Validation failure in buffer push method creation');
    }
}

function checkAttributeTypeName(input) {
    if (Object.keys(Buffer.AttributeType).indexOf(input) === -1) {
        throw new Error('Validation failure in buffer push method creation');
    } else {
        return input;
    }
}

module.exports = Buffer;
