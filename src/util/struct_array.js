// @flow

// Note: all "sizes" are measured in bytes

const assert = require('assert');
const {register} = require('./web_worker_transfer');
const Point = require('@mapbox/point-geometry');

import type {Transferable} from '../types/transferable';

module.exports = createStructArrayType;

const viewTypes = {
    'Int8': Int8Array,
    'Uint8': Uint8Array,
    'Int16': Int16Array,
    'Uint16': Uint16Array,
    'Int32': Int32Array,
    'Uint32': Uint32Array,
    'Float32': Float32Array
};

export type ViewType = $Keys<typeof viewTypes>;

/**
 * @typedef {Object} StructMember
 * @private
 * @property {string} name
 * @property {string} type
 * @property {number} components
 */

/**
 * @private
 */
class Struct {
    _pos1: number;
    _pos2: number;
    _pos4: number;
    _pos8: number;
    _structArray: StructArray;

    // The following properties are defined on the prototype of sub classes.
    size: number;
    alignment: number;

    /**
     * @param {StructArray} structArray The StructArray the struct is stored in
     * @param {number} index The index of the struct in the StructArray.
     * @private
     */
    constructor(structArray: StructArray, index: number) {
        this._structArray = structArray;
        this._pos1 = index * this.size;
        this._pos2 = this._pos1 / 2;
        this._pos4 = this._pos1 / 4;
        this._pos8 = this._pos1 / 8;
    }
}

const DEFAULT_CAPACITY = 128;
const RESIZE_MULTIPLIER = 5;

export type StructArrayMember = {
    name: string,
    type: ViewType,
    components: number,
    offset: number
};

export type StructArrayTypeParameters = {
    members: $ReadOnlyArray<{
        name: string,
        type: ViewType,
        +components?: number,
    }>,
    alignment?: number
};

type SerializedStructArray = {
    length: number,
    arrayBuffer: ArrayBuffer,
    type: StructArrayTypeParameters,
    cacheKey?: string
};

const structArrayTypeCache: {[key: string]: Class<StructArray>} = {}; // eslint-disable-line no-use-before-define

/**
 * The StructArray class is inherited by the custom StructArrayType classes created with
 * `createStructArrayType(members, options)`.
 * @private
 */
class StructArray {
    capacity: number;
    length: number;
    isTransferred: boolean;
    arrayBuffer: ArrayBuffer;
    int8: ?Int8Array;
    uint8: Uint8Array;
    uint8clamped: ?Uint8ClampedArray;
    int16: ?Int16Array;
    uint16: ?Uint16Array;
    int32: ?Int32Array;
    uint32: ?Uint32Array;
    float32: ?Float32Array;
    float64: ?Float64Array;

    // The following properties are defined on the prototype.
    members: Array<StructArrayMember>;
    StructType: typeof Struct;
    bytesPerElement: number;
    _usedTypes: Array<ViewType>;
    emplaceBack: Function;

    _cacheKey: string;

    constructor() {
        this.isTransferred = false;
        this.capacity = -1;
        this.resize(0);
    }

    /**
     * Serialize a StructArray instance.  Serializes both the raw data and the
     * metadata needed to reconstruct the StructArray base class during
     * deserialization.
     */
    static serialize(array: StructArray, transferables?: Array<Transferable>): SerializedStructArray {
        assert(!array.isTransferred);

        array._trim();

        if (transferables) {
            array.isTransferred = true;
            transferables.push(array.arrayBuffer);
        }

        return {
            length: array.length,
            arrayBuffer: array.arrayBuffer,
            type: {
                members: array.constructor.prototype.members,
                alignment: array.constructor.prototype.StructType.prototype.alignment
            },
            cacheKey: array.constructor.prototype._cacheKey
        };
    }

    static deserialize(input: SerializedStructArray): StructArray {
        const Klass = input.cacheKey && input.cacheKey in structArrayTypeCache ?
            structArrayTypeCache[input.cacheKey] :
            createStructArrayType(input.type);
        const structArray = Object.create(Klass.prototype);
        structArray.arrayBuffer = input.arrayBuffer;
        structArray.length = input.length;
        structArray.capacity = structArray.arrayBuffer.byteLength / structArray.bytesPerElement;
        structArray._refreshViews();
        return structArray;
    }

    /**
     * Return the Struct at the given location in the array.
     * @param {number} index The index of the element.
     */
    get(index: number) {
        assert(!this.isTransferred);
        return new this.StructType(this, index);
    }

    /**
     * Resize the array to discard unused capacity.
     */
    _trim() {
        if (this.length !== this.capacity) {
            this.capacity = this.length;
            this.arrayBuffer = this.arrayBuffer.slice(0, this.length * this.bytesPerElement);
            this._refreshViews();
        }
    }

    /**
     * Resets the the length of the array to 0 without de-allocating capcacity.
     */
    clear() {
        this.length = 0;
    }

    /**
     * Resize the array.
     * If `n` is greater than the current length then additional elements with undefined values are added.
     * If `n` is less than the current length then the array will be reduced to the first `n` elements.
     * @param {number} n The new size of the array.
     */
    resize(n: number) {
        assert(!this.isTransferred);

        this.length = n;
        if (n > this.capacity) {
            this.capacity = Math.max(n, Math.floor(this.capacity * RESIZE_MULTIPLIER), DEFAULT_CAPACITY);
            this.arrayBuffer = new ArrayBuffer(this.capacity * this.bytesPerElement);

            const oldUint8Array = this.uint8;
            this._refreshViews();
            if (oldUint8Array) this.uint8.set(oldUint8Array);
        }
    }

    /**
     * Create TypedArray views for the current ArrayBuffer.
     */
    _refreshViews() {
        for (const type of this._usedTypes) {
            // $FlowFixMe
            this[getArrayViewName(type)] = new viewTypes[type](this.arrayBuffer);
        }
    }

    /**
     * Output the `StructArray` between indices `startIndex` and `endIndex` as an array of `StructTypes` to enable sorting
     * @param {number} startIndex
     * @param {number} endIndex
     */
    toArray(startIndex: number, endIndex: number) {
        assert(!this.isTransferred);

        const array = [];

        for (let i = startIndex; i < endIndex; i++) {
            const struct = this.get(i);
            array.push(struct);
        }

        return array;
    }
}

register('StructArray', StructArray);

class StructArrayType extends StructArray {}
register('StructArrayType', StructArrayType);

export type { StructArray as StructArray };

/**
 * `createStructArrayType` is used to create new `StructArray` types.
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
 * @class
 * @param {Object} options
 * @param {number} options.alignment Use `4` to align members to 4 byte boundaries. Default is 1.
 * @param {Array<StructMember>} options.members
 * @example
 *
 * var PointArrayType = createStructArrayType({
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

function createStructArrayType(options: StructArrayTypeParameters): Class<StructArray> {
    const key = JSON.stringify(options);

    if (structArrayTypeCache[key]) {
        return structArrayTypeCache[key];
    }

    const alignment = options.alignment === undefined ? 1 : options.alignment;

    let offset = 0;
    let maxSize = 0;
    const usedTypes = ['Uint8'];

    let hasAnchorPoint = false;

    const members = options.members.map((member) => {
        assert(member.name.length);
        assert(member.type in viewTypes);

        if (usedTypes.indexOf(member.type) < 0) usedTypes.push(member.type);
        if (member.name === 'anchorPointX') hasAnchorPoint = true;

        const typeSize = sizeOf(member.type);
        const memberOffset = offset = align(offset, Math.max(alignment, typeSize));
        const components = member.components || 1;

        maxSize = Math.max(maxSize, typeSize);
        offset += typeSize * components;

        return {
            name: member.name,
            type: member.type,
            components: components,
            offset: memberOffset
        };
    });

    const size = align(offset, Math.max(maxSize, alignment));

    class StructType extends Struct {}

    StructType.prototype.alignment = alignment;
    StructType.prototype.size = size;

    for (const member of members) {
        for (let c = 0; c < member.components; c++) {
            let name = member.name;
            if (member.components > 1) {
                name += c;
            }
            if (name in StructType.prototype) {
                throw new Error(`${name} is a reserved name and cannot be used as a member name.`);
            }
            Object.defineProperty(
                StructType.prototype,
                name,
                createAccessors(member, c)
            );
        }
    }

    // Special case used for the CollisionBoxArray type
    if (hasAnchorPoint) {
        // https://github.com/facebook/flow/issues/285
        (Object.defineProperty: any)(StructType.prototype, 'anchorPoint', {
            get() { return new Point(this.anchorPointX, this.anchorPointY); }
        });
    }

    class StructArrayType extends StructArray {}

    StructArrayType.prototype.members = members;
    StructArrayType.prototype.StructType = StructType;
    StructArrayType.prototype.bytesPerElement = size;
    StructArrayType.prototype.emplaceBack = createEmplaceBack(members, size);
    StructArrayType.prototype._usedTypes = usedTypes;

    StructArrayType.prototype._cacheKey = key;

    structArrayTypeCache[key] = StructArrayType;

    for (const member of members) {
        for (let c = 0; c < member.components; c++) {
            let name = `get${member.name}`;
            if (member.components > 1) {
                name += c;
            }
            if (name in StructArrayType.prototype) {
                throw new Error(`${name} is a reserved name and cannot be used as a member name.`);
            }
            // $FlowFixMe
            StructArrayType.prototype[name] = createIndexedMemberComponentGetter(member, c, size);
        }
    }

    return StructArrayType;
}

function align(offset: number, size: number): number {
    return Math.ceil(offset / size) * size;
}

function sizeOf(type: ViewType): number {
    return viewTypes[type].BYTES_PER_ELEMENT;
}

function getArrayViewName(type: ViewType): string {
    return type.toLowerCase();
}

/*
 * > I saw major perf gains by shortening the source of these generated methods (i.e. renaming
 * > elementIndex to i) (likely due to v8 inlining heuristics).
 * - lucaswoj
 */
function createEmplaceBack(members, bytesPerElement): Function {
    const usedTypeSizes = [];
    const argNames = [];
    let body =
        'var i = this.length;\n' +
        'this.resize(this.length + 1);\n';

    for (const member of members) {
        const size = sizeOf(member.type);

        // array offsets to the end of current data for each type size
        // var o{SIZE} = i * ROUNDED(bytesPerElement / size);
        if (usedTypeSizes.indexOf(size) < 0) {
            usedTypeSizes.push(size);
            body += `var o${size.toFixed(0)} = i * ${(bytesPerElement / size).toFixed(0)};\n`;
        }

        for (let c = 0; c < member.components; c++) {
            // arguments v0, v1, v2, ... are, in order, the components of
            // member 0, then the components of member 1, etc.
            const argName = `v${argNames.length}`;
            // The index for `member` component `c` into the appropriate type array is:
            // this.{TYPE}[o{SIZE} + MEMBER_OFFSET + {c}] = v{X}
            // where MEMBER_OFFSET = ROUND(member.offset / size) is the per-element
            // offset of this member into the array
            const index = `o${size.toFixed(0)} + ${(member.offset / size + c).toFixed(0)}`;
            body += `this.${getArrayViewName(member.type)}[${index}] = ${argName};\n`;
            argNames.push(argName);
        }
    }

    body += 'return i;';

    return new Function(argNames.toString(), body);
}

function createMemberComponentString(member, component) {
    const elementOffset = `this._pos${sizeOf(member.type).toFixed(0)}`;
    const componentOffset = (member.offset / sizeOf(member.type) + component).toFixed(0);
    const index = `${elementOffset} + ${componentOffset}`;
    return `this._structArray.${getArrayViewName(member.type)}[${index}]`;
}

function createIndexedMemberComponentGetter(member, component, size) {
    const componentOffset = (member.offset / sizeOf(member.type) + component).toFixed(0);
    const componentStride = size / sizeOf(member.type);
    return new Function('index',
        `return this.${getArrayViewName(member.type)}[index * ${componentStride} + ${componentOffset}];`);
}

function createAccessors(member, c) {
    const code = createMemberComponentString(member, c);
    return {
        get: new Function(`return ${code};`),
        set: new Function('x', `${code} = x;`)
    };
}
