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
 * @param {Object.<string, BufferAttribute>} options.attributes
 */
function Buffer(options) {

    // Create a new Buffer
    if (!options.isSerializedMapboxBuffer) {

        this.type = options.type;
        this.size = align(Buffer.SIZE_DEFAULT, Buffer.SIZE_ALIGNMENT);
        this.length = 0;
        this.arrayBuffer = new ArrayBuffer(this.size);
        this.attributes = {};
        this.itemSize = 0;

        this._refreshArrayBufferViews();

        // Vertex buffer attributes must be aligned to "word" boundaries (4 bytes) but element
        // buffer attributes do not need to be aligned.
        var attributeAlignment;
        if (this.type === Buffer.BufferType.VERTEX) {
            attributeAlignment = Buffer.VERTEX_ATTRIBUTE_OFFSET_ALIGNMENT;
        } else {
            attributeAlignment = null;
        }

        // Normalize the attributes
        for (var key in options.attributes) {
            var attribute = util.extend({}, options.attributes[key]);

            attribute.name = attribute.name || key;
            attribute.components = attribute.components || 1;
            attribute.type = attribute.type || Buffer.AttributeType.UNSIGNED_BYTE;
            attribute.size = attribute.type.size * attribute.components;
            attribute.offset = this.itemSize;

            this.itemSize = align(attribute.offset + attribute.size, attributeAlignment);

            this.attributes[attribute.name] = attribute;
        }

    // Restore a serialized buffer
    } else {
        var clone = options;

        this.type = clone.type;
        this.size = clone.size;
        this.length = clone.index;
        this.arrayBuffer = clone.arrayBuffer;
        this.attributes = clone.attributes;
        this.itemSize = clone.itemSize;

        this._refreshArrayBufferViews();
    }

    util.assert(this.type);

    // Enable some shortcuts if there is only one attribute on this buffer.
    var attributeNames = Object.keys(this.attributes);
    if (attributeNames.length === 1) {
        this.singleAttribute = this.attributes[attributeNames[0]];
    } else {
        this.singleAttribute = null;
    }
}

Buffer.prototype.isMapboxBuffer = true;

/**
 * Push an item onto the end of the buffer. Grows the buffer if necessary.
 * @private
 * @param {(BufferItem|BufferValue)} item Item to be appended. If the buffer only has one attribute,
 * can be a single value.
 * @returns {number} The index of the appended item.
 */
Buffer.prototype.push = function(item) {
    var index = this.length;
    this.length++;
    this.set(index, item);
    return index;
};

/**
 * Set an item at a particular index. Grows the buffer if necessary.
 * @private
 * @param {number} index The index of the item to set
 * @param {(BufferItem|BufferValue)} item the item to set. If the buffer only has one attribute,
 * it can be a single value instead of an item.
 */
Buffer.prototype.set = function(index, item) {
    if (typeof item === "object" && item !== null && !Array.isArray(item)) {
        for (var attributeName in item) {
           this.setAttribute(index, attributeName, item[attributeName]);
        }
    } else {
        util.assert(this.singleAttribute);
        this.setAttribute(index, this.singleAttribute.name, item);
    }
};

/**
 * Set an attribute for an item at a particular index. Grows the buffer if necessary.
 * @private
 * @param {number} index The index of the item to set
 * @param {(string|BufferAttribute)} attribute The attribute of the item to set
 * @param {BufferValue} value
 */
Buffer.prototype.setAttribute = function(index, attribute, value) {
    attribute = this._normalizeAttributeReference(attribute);

    // Resize the buffer if necessary
    while (this.getIndexOffset(index + 1) > this.size) {
        this._resize(this.size * 1.5);
    }
    this.length = Math.max(this.length, index + 1);
    util.assert(this.getIndexOffset(index + 1) <= this.size);


    if (!Array.isArray(value)) value = [value];

    util.assert(value.length === attribute.components);
    for (var componentIndex = 0; componentIndex < attribute.components; componentIndex++) {
        var offset = this.getIndexAttributeOffset(index, attribute.name, componentIndex) / attribute.type.size;
        var arrayBufferView = this.arrayBufferViews[attribute.type.name];
        util.assert(isNumeric(value[componentIndex]));
        arrayBufferView[offset] = value[componentIndex];
    }
};

/**
 * Get an item from the `ArrayBuffer`.
 * @private
 * @param {number} index The index of the item to get
 * @returns {BufferItem}
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

/**
 * Serialize the buffer to be transferred between threads via `postMessage`. This is a destructive
 * operation because it is assumed that the ownership of the buffer will be transferred to another
 * thread.
 * @private
 * @returns { serialized: Object, transferables: Array.<ArrayBuffer> }
 */
Buffer.prototype.serialize = function() {
    var output = {
        serialized: {
            type: this.type,
            attributes: this.attributes,
            itemSize: this.itemSize,
            size: this.size,
            index: this.length,
            arrayBuffer: this.arrayBuffer,
            isSerializedMapboxBuffer: true
        },
        transferables: [this.arrayBuffer]
    };

    this.arrayBuffer = null;
    this.arrayBufferViews = null;

    return output;
};

/**
 * Get the byte offset of a particular index.
 * @private
 * @param {number} index
 */
Buffer.prototype.getIndexOffset = function(index) {
    return index * this.itemSize;
};

/**
 * Get the byte offset of an attribute at a particular item index
 * @private
 * @param {number} index
 * @param {string|BufferAttribute} attribute The attribute to set
 * @param {number} componentIndex
 */
Buffer.prototype.getIndexAttributeOffset = function(index, attributeName, componentIndex) {
    var attribute = this.attributes[attributeName];
    return (
        this.getIndexOffset(index) +
        attribute.offset +
        attribute.type.size * (componentIndex || 0)
    );
};

/**
 * @private
 * @param {(BufferAttribute|string)}
 * @returns {BufferAttribute}
 */
Buffer.prototype._normalizeAttributeReference = function(attribute) {
    if (typeof attribute === 'string') {
        return this.attributes[attribute];
    } else {
        return attribute;
    }
};

Buffer.prototype._resize = function(size) {
    var old = this.arrayBufferViews.UNSIGNED_BYTE;
    this.size = align(size, Buffer.SIZE_ALIGNMENT);
    this.arrayBuffer = new ArrayBuffer(this.size);
    this._refreshArrayBufferViews();
    this.arrayBufferViews.UNSIGNED_BYTE.set(old);
};

Buffer.prototype._refreshArrayBufferViews = function() {
    this.arrayBufferViews = {
        UNSIGNED_BYTE:  new Uint8Array(this.arrayBuffer),
        BYTE:           new Int8Array(this.arrayBuffer),
        UNSIGNED_SHORT: new Uint16Array(this.arrayBuffer),
        SHORT:          new Int16Array(this.arrayBuffer)
    };
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
 * @typedef {Object.<string, BufferValue>} BufferItem
 * @private
 */

/**
 * @typedef {(number|Array.<number>)} BufferValue
 * @private
 */

/**
 * @enum {string} BufferType
 * @private
 * @readonly
 */
Buffer.BufferType = {
    VERTEX: 'ARRAY_BUFFER',
    ELEMENT:  'ELEMENT_ARRAY_BUFFER'
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
Buffer.ELEMENT_INDEX_ATTRIBUTE_TYPE = Buffer.AttributeType.UNSIGNED_SHORT;

/**
 * @property {number}
 * @private
 * @readonly
 */
Buffer.SIZE_DEFAULT = 8192;

/**
 * WebGL performs best if buffer sizes are aligned to 2 byte boundaries.
 * @property {number}
 * @private
 * @readonly
 */
Buffer.SIZE_ALIGNMENT = 2;

/**
 * WebGL performs best if vertex attribute offsets are aligned to 4 byte boundaries.
 * @property {number}
 * @private
 * @readonly
 */
Buffer.VERTEX_ATTRIBUTE_OFFSET_ALIGNMENT = 4;

function align(value, alignment) {
    alignment = alignment || 1;
    var remainder = value % alignment;
    if (alignment !== 1 && remainder !== 0) {
        value += (alignment - remainder);
    }
    return value;
}

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

module.exports = Buffer;
