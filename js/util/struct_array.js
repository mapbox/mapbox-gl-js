'use strict';

var inherit = require('./util').inherit;

module.exports = createStructArrayType;

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

function createStructArrayType(members, methods) {
    if (methods === undefined) methods = {};

    function StructType() {
        Struct.apply(this, arguments);
    }

    StructType.prototype = inherit(Struct, methods);

    var offset = 0;
    var maxSize = 0;

    for (var m = 0; m < members.length; m++) {
        var member = members[m];

        if (!viewTypes[member.type]) {
            throw new Error(JSON.stringify(member.type) + ' is not a valid type');
        }

        var size = sizeOf(member.type);
        maxSize = Math.max(maxSize, size);
        offset = member.offset = align(offset, size);

        Object.defineProperty(StructType.prototype, member.name, {
            get: createGetter(member.type, offset),
            set: createSetter(member.type, offset)
        });

        offset += size;
    }

    StructType.prototype.BYTE_SIZE = align(offset, maxSize);

    function StructArrayType() {
        StructArray.apply(this, arguments);
    }

    StructArrayType.prototype = Object.create(StructArray.prototype);
    StructArrayType.prototype.StructType = StructType;
    StructArrayType.prototype.BYTES_PER_ELEMENT = StructType.prototype.BYTE_SIZE;
    StructArrayType.prototype.emplaceBack = createEmplaceBack(members, StructType.prototype.BYTE_SIZE);

    return StructArrayType;
}

function align(offset, size) {
    return Math.ceil(offset / size) * size;
}

function sizeOf(type) {
    return viewTypes[type].BYTES_PER_ELEMENT;
}

function getArrayViewName(type) {
    return type.toLowerCase() + 'Array';
}


function createEmplaceBack(members, BYTES_PER_ELEMENT) {
    var argNames = [];
    var body = '' +
    'var pos1 = this.length * ' + BYTES_PER_ELEMENT.toFixed(0) + ';\n' +
    'var pos2 = pos1 / 2;\n' +
    'var pos4 = pos1 / 4;\n' +
    'this.length++;\n' +
    'this.metadataArray[0]++;\n' +
    'if (this.length > this.allocatedLength) this.resize(this.length);\n';
    for (var m = 0; m < members.length; m++) {
        var member = members[m];
        var argName = 'arg_' + m;
        var index = 'pos' + sizeOf(member.type).toFixed(0) + ' + ' + (member.offset / sizeOf(member.type)).toFixed(0);
        body += 'this.' + getArrayViewName(member.type) + '[' + index + '] = ' + argName + ';\n';
        argNames.push(argName);
    }
    return new Function(argNames, body);
}

function createGetter(type, offset) {
    var index = 'this._pos' + sizeOf(type).toFixed(0) + ' + ' + (offset / sizeOf(type)).toFixed(0);
    return new Function([], 'return this._structArray.' + getArrayViewName(type) + '[' + index + '];');
}

function createSetter(type, offset) {
    var index = 'this._pos' + sizeOf(type).toFixed(0) + ' + ' + (offset / sizeOf(type)).toFixed(0);
    return new Function(['x'], 'this._structArray.' + getArrayViewName(type) + '[' + index + '] = x;');
}


function Struct(structArray, index) {
    this._structArray = structArray;
    this._setIndex(index);
}

Struct.prototype._setIndex = function(index) {
    this._pos1 = index * this.BYTE_SIZE;
    this._pos2 = this._pos1 / 2;
    this._pos4 = this._pos1 / 4;
};


function StructArray(initialAllocatedLength) {
    if (initialAllocatedLength instanceof ArrayBuffer) {
        this.arrayBuffer = initialAllocatedLength;
        this._refreshViews();
        this.length = this.metadataArray[0];
        this.allocatedLength = this.uint8Array.length / this.BYTES_PER_ELEMENT;
    } else {
        if (initialAllocatedLength === undefined) {
            initialAllocatedLength = this.DEFAULT_ALLOCATED_LENGTH;
        }
        this.resize(initialAllocatedLength);
    }
}

StructArray.prototype.DEFAULT_ALLOCATED_LENGTH = 100;
StructArray.prototype.RESIZE_FACTOR = 1.5;
StructArray.prototype.allocatedLength = 0;
StructArray.prototype.length = 0;
var METADATA_BYTES = align(4, 8);

StructArray.prototype.resize = function(n) {
    this.allocatedLength = Math.max(n, Math.floor(this.allocatedLength * this.RESIZE_FACTOR));
    this.arrayBuffer = new ArrayBuffer(METADATA_BYTES + align(this.allocatedLength * this.BYTES_PER_ELEMENT, 8));

    var oldUint8Array = this.uint8Array;
    this._refreshViews();
    if (oldUint8Array) this.uint8Array.set(oldUint8Array);
};

StructArray.prototype._refreshViews = function() {
    for (var t in viewTypes) {
        this[getArrayViewName(t)] = new viewTypes[t](this.arrayBuffer, METADATA_BYTES);
    }
    this.metadataArray = new Uint32Array(this.arrayBuffer, 0, 1);
};

StructArray.prototype.at = function(index) {
    return new this.StructType(this, index);
};
