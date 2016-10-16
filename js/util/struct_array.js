'use strict';

// Note: all "sizes" are measured in bytes

var assert = require('assert');

module.exports = StructArrayType;

var viewTypes = {
    'Int8': Int8Array,
    'Uint8': Uint8Array,
    'Uint8Clamped': Uint8ClampedArray,
    'Int16': Int16Array,
    'Uint16': Uint16Array,
    'Int32': Int32Array,
    'Uint32': Uint32Array,
    'Float32': Float32Array,
    'Float64': Float64Array
};

/**
 * @typedef StructMember
 * @private
 * @property {string} name
 * @property {string} type
 * @property {number} components
 */

var structArrayTypeCache = {};

/**
 * `StructArrayType` is used to create new `StructArray` types.
 *
 * `StructArray` provides an abstraction over `ArrayBuffer` and `TypedArray` making it behave like
 * an array of typed structs. A StructArray is comprised of elements. Each element has a set of
 * members that are defined when the `StructArrayType` is created.
 *
 * StructArrays useful for creating large arrays that:
 * - can be transferred from workers as a Transferable object
 * - can be copied cheaply
 * - use less memory for lower-precision members
 * - can be used as buffers in WebGL.
 *
 * @class StructArrayType
 * @param {Array.<StructMember>}
 * @param options
 * @param {number} options.alignment Use `4` to align members to 4 byte boundaries. Default is 1.
 *
 * @example
 *
 * var PointArrayType = new StructArrayType({
 *  members: [
 *      { type: 'Int16', name: 'x' },
 *      { type: 'Int16', name: 'y' }
 *  ]});
 *
 *  var pointArray = new PointArrayType();
 *  pointArray.emplaceBack(10, 15);
 *  pointArray.emplaceBack(20, 35);
 *
 *  point = pointArray.get(0);
 *  assert(point.x === 10);
 *  assert(point.y === 15);
 *
 * @private
 */
function StructArrayType(options) {

    var key = JSON.stringify(options);
    if (structArrayTypeCache[key]) {
        return structArrayTypeCache[key];
    }

    if (options.alignment === undefined) options.alignment = 1;

    function StructType() {
        Struct.apply(this, arguments);
    }

    StructType.prototype = Object.create(Struct.prototype);

    var offset = 0;
    var maxSize = 0;
    var usedTypes = ['Uint8'];

    StructType.prototype.members = options.members.map(function(member) {
        member = {
            name: member.name,
            type: member.type,
            components: member.components || 1
        };

        assert(member.name.length);
        assert(member.type in viewTypes);

        if (usedTypes.indexOf(member.type) < 0) usedTypes.push(member.type);

        var typeSize = sizeOf(member.type);
        maxSize = Math.max(maxSize, typeSize);
        member.offset = offset = align(offset, Math.max(options.alignment, typeSize));

        for (var c = 0; c < member.components; c++) {
            Object.defineProperty(StructType.prototype, member.name + (member.components === 1 ? '' : c), {
                get: createGetter(member, c),
                set: createSetter(member, c)
            });
        }

        offset += typeSize * member.components;

        return member;
    });

    StructType.prototype.alignment = options.alignment;
    StructType.prototype.size = align(offset, Math.max(maxSize, options.alignment));

    function StructArrayType() {
        StructArray.apply(this, arguments);
        this.members = StructType.prototype.members;
    }

    StructArrayType.serialize = serializeStructArrayType;

    StructArrayType.prototype = Object.create(StructArray.prototype);
    StructArrayType.prototype.StructType = StructType;
    StructArrayType.prototype.bytesPerElement = StructType.prototype.size;
    StructArrayType.prototype.emplaceBack = createEmplaceBack(StructType.prototype.members, StructType.prototype.size);
    StructArrayType.prototype._usedTypes = usedTypes;


    structArrayTypeCache[key] = StructArrayType;

    return StructArrayType;
}

/**
 * Serialize the StructArray type. This serializes the *type* not an instance of the type.
 * @private
 */
function serializeStructArrayType() {
    return {
        members: this.prototype.StructType.prototype.members,
        alignment: this.prototype.StructType.prototype.alignment,
        bytesPerElement: this.prototype.bytesPerElement
    };
}


function align(offset, size) {
    return Math.ceil(offset / size) * size;
}

function sizeOf(type) {
    return viewTypes[type].BYTES_PER_ELEMENT;
}

function getArrayViewName(type) {
    return type.toLowerCase();
}


/*
 * > I saw major perf gains by shortening the source of these generated methods (i.e. renaming
 * > elementIndex to i) (likely due to v8 inlining heuristics).
 * - lucaswoj
 */
function createEmplaceBack(members, bytesPerElement) {
    var usedTypeSizes = [];
    var argNames = [];
    var body = '' +
    'var i = this.length;\n' +
    'this.resize(this.length + 1);\n';

    for (var m = 0; m < members.length; m++) {
        var member = members[m];
        var size = sizeOf(member.type);

        // array offsets to the end of current data for each type size
        // var o{SIZE} = i * ROUNDED(bytesPerElement / size);
        if (usedTypeSizes.indexOf(size) < 0) {
            usedTypeSizes.push(size);
            body += 'var o' + size.toFixed(0) + ' = i * ' + (bytesPerElement / size).toFixed(0) + ';\n';
        }

        for (var c = 0; c < member.components; c++) {
            // arguments v0, v1, v2, ... are, in order, the components of
            // member 0, then the components of member 1, etc.
            var argName = 'v' + argNames.length;
            // The index for `member` component `c` into the appropriate type array is:
            // this.{TYPE}[o{SIZE} + MEMBER_OFFSET + {c}] = v{X}
            // where MEMBER_OFFSET = ROUND(member.offset / size) is the per-element
            // offset of this member into the array
            var index = 'o' + size.toFixed(0) + ' + ' + (member.offset / size + c).toFixed(0);
            body += 'this.' + getArrayViewName(member.type) + '[' + index + '] = ' + argName + ';\n';
            argNames.push(argName);
        }
    }

    body += 'return i;';

    return new Function(argNames, body);
}

function createMemberComponentString(member, component) {
    var elementOffset = 'this._pos' + sizeOf(member.type).toFixed(0);
    var componentOffset = (member.offset / sizeOf(member.type) + component).toFixed(0);
    var index = elementOffset + ' + ' + componentOffset;
    return 'this._structArray.' + getArrayViewName(member.type) + '[' + index + ']';

}

function createGetter(member, c) {
    return new Function([], 'return ' + createMemberComponentString(member, c) + ';');
}

function createSetter(member, c) {
    return new Function(['x'], createMemberComponentString(member, c) + ' = x;');
}

/**
 * @class Struct
 * @param {StructArray} structArray The StructArray the struct is stored in
 * @param {number} index The index of the struct in the StructArray.
 * @private
 */
function Struct(structArray, index) {
    this._structArray = structArray;
    this._pos1 = index * this.size;
    this._pos2 = this._pos1 / 2;
    this._pos4 = this._pos1 / 4;
    this._pos8 = this._pos1 / 8;
}

/**
 * @class StructArray
 * The StructArray class is inherited by the custom StructArrayType classes created with
 * `new StructArrayType(members, options)`.
 * @private
 */
function StructArray(serialized) {
    if (serialized !== undefined) {
    // Create from an serialized StructArray
        this.arrayBuffer = serialized.arrayBuffer;
        this.length = serialized.length;
        this.capacity = this.arrayBuffer.byteLength / this.bytesPerElement;
        this._refreshViews();

    // Create a new StructArray
    } else {
        this.capacity = -1;
        this.resize(0);
    }
}

/**
 * @property {number}
 * @private
 * @readonly
 */
StructArray.prototype.DEFAULT_CAPACITY = 128;

/**
 * @property {number}
 * @private
 * @readonly
 */
StructArray.prototype.RESIZE_MULTIPLIER = 5;

/**
 * Serialize this StructArray instance
 * @private
 */
StructArray.prototype.serialize = function() {
    this.trim();
    return {
        length: this.length,
        arrayBuffer: this.arrayBuffer
    };
};

/**
 * Return the Struct at the given location in the array.
 * @private
 * @param {number} index The index of the element.
 */
StructArray.prototype.get = function(index) {
    return new this.StructType(this, index);
};

/**
 * Resize the array to discard unused capacity.
 * @private
 */
StructArray.prototype.trim = function() {
    if (this.length !== this.capacity) {
        this.capacity = this.length;
        this.arrayBuffer = this.arrayBuffer.slice(0, this.length * this.bytesPerElement);
        this._refreshViews();
    }
};

/**
 * Resize the array.
 * If `n` is greater than the current length then additional elements with undefined values are added.
 * If `n` is less than the current length then the array will be reduced to the first `n` elements.
 * @param {number} n The new size of the array.
 */
StructArray.prototype.resize = function(n) {
    this.length = n;
    if (n > this.capacity) {
        this.capacity = Math.max(n, Math.floor(this.capacity * this.RESIZE_MULTIPLIER), this.DEFAULT_CAPACITY);
        this.arrayBuffer = new ArrayBuffer(this.capacity * this.bytesPerElement);

        var oldUint8Array = this.uint8;
        this._refreshViews();
        if (oldUint8Array) this.uint8.set(oldUint8Array);
    }
};

/**
 * Create TypedArray views for the current ArrayBuffer.
 * @private
 */
StructArray.prototype._refreshViews = function() {
    for (var t = 0; t < this._usedTypes.length; t++) {
        var type = this._usedTypes[t];
        this[getArrayViewName(type)] = new viewTypes[type](this.arrayBuffer);
    }
};

/**
 * Output the `StructArray` between indices `startIndex` and `endIndex` as an array of `StructTypes` to enable sorting
 * @param {number} startIndex
 * @param {number} endIndex
 * @private
 */
StructArray.prototype.toArray = function(startIndex, endIndex) {
    var array = [];

    for (var i = startIndex; i < endIndex; i++) {
        var struct = this.get(i);
        array.push(struct);
    }

    return array;
};
