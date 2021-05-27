// This file is generated. Edit build/generate-struct-arrays.js, then run `yarn run codegen`.
/* eslint-disable camelcase */
// @flow

import assert from 'assert';
import {Struct, StructArray} from '../util/struct_array.js';
import {register} from '../util/web_worker_transfer.js';
import Point from '@mapbox/point-geometry';

/**
 * Implementation of the StructArray layout:
 * [0]: Int16[2]
 *
 * @private
 */
class StructArrayLayout2i4 extends StructArray {
    uint8: Uint8Array;
    int16: Int16Array;

    _refreshViews() {
        this.uint8 = new Uint8Array(this.arrayBuffer);
        this.int16 = new Int16Array(this.arrayBuffer);
    }

    emplaceBack(v0: number, v1: number) {
        const i = this.length;
        this.resize(i + 1);
        return this.emplace(i, v0, v1);
    }

    emplace(i: number, v0: number, v1: number) {
        const o2 = i * 2;
        this.int16[o2 + 0] = v0;
        this.int16[o2 + 1] = v1;
        return i;
    }
}

StructArrayLayout2i4.prototype.bytesPerElement = 4;
register('StructArrayLayout2i4', StructArrayLayout2i4);

/**
 * Implementation of the StructArray layout:
 * [0]: Int16[4]
 *
 * @private
 */
class StructArrayLayout4i8 extends StructArray {
    uint8: Uint8Array;
    int16: Int16Array;

    _refreshViews() {
        this.uint8 = new Uint8Array(this.arrayBuffer);
        this.int16 = new Int16Array(this.arrayBuffer);
    }

    emplaceBack(v0: number, v1: number, v2: number, v3: number) {
        const i = this.length;
        this.resize(i + 1);
        return this.emplace(i, v0, v1, v2, v3);
    }

    emplace(i: number, v0: number, v1: number, v2: number, v3: number) {
        const o2 = i * 4;
        this.int16[o2 + 0] = v0;
        this.int16[o2 + 1] = v1;
        this.int16[o2 + 2] = v2;
        this.int16[o2 + 3] = v3;
        return i;
    }
}

StructArrayLayout4i8.prototype.bytesPerElement = 8;
register('StructArrayLayout4i8', StructArrayLayout4i8);

/**
 * Implementation of the StructArray layout:
 * [0]: Int16[2]
 * [4]: Uint8[4]
 * [8]: Float32[1]
 *
 * @private
 */
class StructArrayLayout2i4ub1f12 extends StructArray {
    uint8: Uint8Array;
    int16: Int16Array;
    float32: Float32Array;

    _refreshViews() {
        this.uint8 = new Uint8Array(this.arrayBuffer);
        this.int16 = new Int16Array(this.arrayBuffer);
        this.float32 = new Float32Array(this.arrayBuffer);
    }

    emplaceBack(v0: number, v1: number, v2: number, v3: number, v4: number, v5: number, v6: number) {
        const i = this.length;
        this.resize(i + 1);
        return this.emplace(i, v0, v1, v2, v3, v4, v5, v6);
    }

    emplace(i: number, v0: number, v1: number, v2: number, v3: number, v4: number, v5: number, v6: number) {
        const o2 = i * 6;
        const o1 = i * 12;
        const o4 = i * 3;
        this.int16[o2 + 0] = v0;
        this.int16[o2 + 1] = v1;
        this.uint8[o1 + 4] = v2;
        this.uint8[o1 + 5] = v3;
        this.uint8[o1 + 6] = v4;
        this.uint8[o1 + 7] = v5;
        this.float32[o4 + 2] = v6;
        return i;
    }
}

StructArrayLayout2i4ub1f12.prototype.bytesPerElement = 12;
register('StructArrayLayout2i4ub1f12', StructArrayLayout2i4ub1f12);

/**
 * Implementation of the StructArray layout:
 * [0]: Float32[2]
 *
 * @private
 */
class StructArrayLayout2f8 extends StructArray {
    uint8: Uint8Array;
    float32: Float32Array;

    _refreshViews() {
        this.uint8 = new Uint8Array(this.arrayBuffer);
        this.float32 = new Float32Array(this.arrayBuffer);
    }

    emplaceBack(v0: number, v1: number) {
        const i = this.length;
        this.resize(i + 1);
        return this.emplace(i, v0, v1);
    }

    emplace(i: number, v0: number, v1: number) {
        const o4 = i * 2;
        this.float32[o4 + 0] = v0;
        this.float32[o4 + 1] = v1;
        return i;
    }
}

StructArrayLayout2f8.prototype.bytesPerElement = 8;
register('StructArrayLayout2f8', StructArrayLayout2f8);

/**
 * Implementation of the StructArray layout:
 * [0]: Uint16[10]
 *
 * @private
 */
class StructArrayLayout10ui20 extends StructArray {
    uint8: Uint8Array;
    uint16: Uint16Array;

    _refreshViews() {
        this.uint8 = new Uint8Array(this.arrayBuffer);
        this.uint16 = new Uint16Array(this.arrayBuffer);
    }

    emplaceBack(v0: number, v1: number, v2: number, v3: number, v4: number, v5: number, v6: number, v7: number, v8: number, v9: number) {
        const i = this.length;
        this.resize(i + 1);
        return this.emplace(i, v0, v1, v2, v3, v4, v5, v6, v7, v8, v9);
    }

    emplace(i: number, v0: number, v1: number, v2: number, v3: number, v4: number, v5: number, v6: number, v7: number, v8: number, v9: number) {
        const o2 = i * 10;
        this.uint16[o2 + 0] = v0;
        this.uint16[o2 + 1] = v1;
        this.uint16[o2 + 2] = v2;
        this.uint16[o2 + 3] = v3;
        this.uint16[o2 + 4] = v4;
        this.uint16[o2 + 5] = v5;
        this.uint16[o2 + 6] = v6;
        this.uint16[o2 + 7] = v7;
        this.uint16[o2 + 8] = v8;
        this.uint16[o2 + 9] = v9;
        return i;
    }
}

StructArrayLayout10ui20.prototype.bytesPerElement = 20;
register('StructArrayLayout10ui20', StructArrayLayout10ui20);

/**
 * Implementation of the StructArray layout:
 * [0]: Uint16[8]
 *
 * @private
 */
class StructArrayLayout8ui16 extends StructArray {
    uint8: Uint8Array;
    uint16: Uint16Array;

    _refreshViews() {
        this.uint8 = new Uint8Array(this.arrayBuffer);
        this.uint16 = new Uint16Array(this.arrayBuffer);
    }

    emplaceBack(v0: number, v1: number, v2: number, v3: number, v4: number, v5: number, v6: number, v7: number) {
        const i = this.length;
        this.resize(i + 1);
        return this.emplace(i, v0, v1, v2, v3, v4, v5, v6, v7);
    }

    emplace(i: number, v0: number, v1: number, v2: number, v3: number, v4: number, v5: number, v6: number, v7: number) {
        const o2 = i * 8;
        this.uint16[o2 + 0] = v0;
        this.uint16[o2 + 1] = v1;
        this.uint16[o2 + 2] = v2;
        this.uint16[o2 + 3] = v3;
        this.uint16[o2 + 4] = v4;
        this.uint16[o2 + 5] = v5;
        this.uint16[o2 + 6] = v6;
        this.uint16[o2 + 7] = v7;
        return i;
    }
}

StructArrayLayout8ui16.prototype.bytesPerElement = 16;
register('StructArrayLayout8ui16', StructArrayLayout8ui16);

/**
 * Implementation of the StructArray layout:
 * [0]: Int16[4]
 * [8]: Uint16[4]
 * [16]: Int16[4]
 *
 * @private
 */
class StructArrayLayout4i4ui4i24 extends StructArray {
    uint8: Uint8Array;
    int16: Int16Array;
    uint16: Uint16Array;

    _refreshViews() {
        this.uint8 = new Uint8Array(this.arrayBuffer);
        this.int16 = new Int16Array(this.arrayBuffer);
        this.uint16 = new Uint16Array(this.arrayBuffer);
    }

    emplaceBack(v0: number, v1: number, v2: number, v3: number, v4: number, v5: number, v6: number, v7: number, v8: number, v9: number, v10: number, v11: number) {
        const i = this.length;
        this.resize(i + 1);
        return this.emplace(i, v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11);
    }

    emplace(i: number, v0: number, v1: number, v2: number, v3: number, v4: number, v5: number, v6: number, v7: number, v8: number, v9: number, v10: number, v11: number) {
        const o2 = i * 12;
        this.int16[o2 + 0] = v0;
        this.int16[o2 + 1] = v1;
        this.int16[o2 + 2] = v2;
        this.int16[o2 + 3] = v3;
        this.uint16[o2 + 4] = v4;
        this.uint16[o2 + 5] = v5;
        this.uint16[o2 + 6] = v6;
        this.uint16[o2 + 7] = v7;
        this.int16[o2 + 8] = v8;
        this.int16[o2 + 9] = v9;
        this.int16[o2 + 10] = v10;
        this.int16[o2 + 11] = v11;
        return i;
    }
}

StructArrayLayout4i4ui4i24.prototype.bytesPerElement = 24;
register('StructArrayLayout4i4ui4i24', StructArrayLayout4i4ui4i24);

/**
 * Implementation of the StructArray layout:
 * [0]: Float32[3]
 *
 * @private
 */
class StructArrayLayout3f12 extends StructArray {
    uint8: Uint8Array;
    float32: Float32Array;

    _refreshViews() {
        this.uint8 = new Uint8Array(this.arrayBuffer);
        this.float32 = new Float32Array(this.arrayBuffer);
    }

    emplaceBack(v0: number, v1: number, v2: number) {
        const i = this.length;
        this.resize(i + 1);
        return this.emplace(i, v0, v1, v2);
    }

    emplace(i: number, v0: number, v1: number, v2: number) {
        const o4 = i * 3;
        this.float32[o4 + 0] = v0;
        this.float32[o4 + 1] = v1;
        this.float32[o4 + 2] = v2;
        return i;
    }
}

StructArrayLayout3f12.prototype.bytesPerElement = 12;
register('StructArrayLayout3f12', StructArrayLayout3f12);

/**
 * Implementation of the StructArray layout:
 * [0]: Uint32[1]
 *
 * @private
 */
class StructArrayLayout1ul4 extends StructArray {
    uint8: Uint8Array;
    uint32: Uint32Array;

    _refreshViews() {
        this.uint8 = new Uint8Array(this.arrayBuffer);
        this.uint32 = new Uint32Array(this.arrayBuffer);
    }

    emplaceBack(v0: number) {
        const i = this.length;
        this.resize(i + 1);
        return this.emplace(i, v0);
    }

    emplace(i: number, v0: number) {
        const o4 = i * 1;
        this.uint32[o4 + 0] = v0;
        return i;
    }
}

StructArrayLayout1ul4.prototype.bytesPerElement = 4;
register('StructArrayLayout1ul4', StructArrayLayout1ul4);

/**
 * Implementation of the StructArray layout:
 * [0]: Int16[2]
 * [4]: Float32[4]
 * [20]: Int16[1]
 * [24]: Uint32[1]
 * [28]: Uint16[2]
 *
 * @private
 */
class StructArrayLayout2i4f1i1ul2ui32 extends StructArray {
    uint8: Uint8Array;
    int16: Int16Array;
    float32: Float32Array;
    uint32: Uint32Array;
    uint16: Uint16Array;

    _refreshViews() {
        this.uint8 = new Uint8Array(this.arrayBuffer);
        this.int16 = new Int16Array(this.arrayBuffer);
        this.float32 = new Float32Array(this.arrayBuffer);
        this.uint32 = new Uint32Array(this.arrayBuffer);
        this.uint16 = new Uint16Array(this.arrayBuffer);
    }

    emplaceBack(v0: number, v1: number, v2: number, v3: number, v4: number, v5: number, v6: number, v7: number, v8: number, v9: number) {
        const i = this.length;
        this.resize(i + 1);
        return this.emplace(i, v0, v1, v2, v3, v4, v5, v6, v7, v8, v9);
    }

    emplace(i: number, v0: number, v1: number, v2: number, v3: number, v4: number, v5: number, v6: number, v7: number, v8: number, v9: number) {
        const o2 = i * 16;
        const o4 = i * 8;
        this.int16[o2 + 0] = v0;
        this.int16[o2 + 1] = v1;
        this.float32[o4 + 1] = v2;
        this.float32[o4 + 2] = v3;
        this.float32[o4 + 3] = v4;
        this.float32[o4 + 4] = v5;
        this.int16[o2 + 10] = v6;
        this.uint32[o4 + 6] = v7;
        this.uint16[o2 + 14] = v8;
        this.uint16[o2 + 15] = v9;
        return i;
    }
}

StructArrayLayout2i4f1i1ul2ui32.prototype.bytesPerElement = 32;
register('StructArrayLayout2i4f1i1ul2ui32', StructArrayLayout2i4f1i1ul2ui32);

/**
 * Implementation of the StructArray layout:
 * [0]: Int16[2]
 * [4]: Int16[2]
 * [8]: Int16[2]
 *
 * @private
 */
class StructArrayLayout2i2i2i12 extends StructArray {
    uint8: Uint8Array;
    int16: Int16Array;

    _refreshViews() {
        this.uint8 = new Uint8Array(this.arrayBuffer);
        this.int16 = new Int16Array(this.arrayBuffer);
    }

    emplaceBack(v0: number, v1: number, v2: number, v3: number, v4: number, v5: number) {
        const i = this.length;
        this.resize(i + 1);
        return this.emplace(i, v0, v1, v2, v3, v4, v5);
    }

    emplace(i: number, v0: number, v1: number, v2: number, v3: number, v4: number, v5: number) {
        const o2 = i * 6;
        this.int16[o2 + 0] = v0;
        this.int16[o2 + 1] = v1;
        this.int16[o2 + 2] = v2;
        this.int16[o2 + 3] = v3;
        this.int16[o2 + 4] = v4;
        this.int16[o2 + 5] = v5;
        return i;
    }
}

StructArrayLayout2i2i2i12.prototype.bytesPerElement = 12;
register('StructArrayLayout2i2i2i12', StructArrayLayout2i2i2i12);

/**
 * Implementation of the StructArray layout:
 * [0]: Float32[2]
 * [8]: Float32[1]
 * [12]: Int16[2]
 *
 * @private
 */
class StructArrayLayout2f1f2i16 extends StructArray {
    uint8: Uint8Array;
    float32: Float32Array;
    int16: Int16Array;

    _refreshViews() {
        this.uint8 = new Uint8Array(this.arrayBuffer);
        this.float32 = new Float32Array(this.arrayBuffer);
        this.int16 = new Int16Array(this.arrayBuffer);
    }

    emplaceBack(v0: number, v1: number, v2: number, v3: number, v4: number) {
        const i = this.length;
        this.resize(i + 1);
        return this.emplace(i, v0, v1, v2, v3, v4);
    }

    emplace(i: number, v0: number, v1: number, v2: number, v3: number, v4: number) {
        const o4 = i * 4;
        const o2 = i * 8;
        this.float32[o4 + 0] = v0;
        this.float32[o4 + 1] = v1;
        this.float32[o4 + 2] = v2;
        this.int16[o2 + 6] = v3;
        this.int16[o2 + 7] = v4;
        return i;
    }
}

StructArrayLayout2f1f2i16.prototype.bytesPerElement = 16;
register('StructArrayLayout2f1f2i16', StructArrayLayout2f1f2i16);

/**
 * Implementation of the StructArray layout:
 * [0]: Uint8[2]
 * [4]: Float32[2]
 *
 * @private
 */
class StructArrayLayout2ub2f12 extends StructArray {
    uint8: Uint8Array;
    float32: Float32Array;

    _refreshViews() {
        this.uint8 = new Uint8Array(this.arrayBuffer);
        this.float32 = new Float32Array(this.arrayBuffer);
    }

    emplaceBack(v0: number, v1: number, v2: number, v3: number) {
        const i = this.length;
        this.resize(i + 1);
        return this.emplace(i, v0, v1, v2, v3);
    }

    emplace(i: number, v0: number, v1: number, v2: number, v3: number) {
        const o1 = i * 12;
        const o4 = i * 3;
        this.uint8[o1 + 0] = v0;
        this.uint8[o1 + 1] = v1;
        this.float32[o4 + 1] = v2;
        this.float32[o4 + 2] = v3;
        return i;
    }
}

StructArrayLayout2ub2f12.prototype.bytesPerElement = 12;
register('StructArrayLayout2ub2f12', StructArrayLayout2ub2f12);

/**
 * Implementation of the StructArray layout:
 * [0]: Uint16[3]
 *
 * @private
 */
class StructArrayLayout3ui6 extends StructArray {
    uint8: Uint8Array;
    uint16: Uint16Array;

    _refreshViews() {
        this.uint8 = new Uint8Array(this.arrayBuffer);
        this.uint16 = new Uint16Array(this.arrayBuffer);
    }

    emplaceBack(v0: number, v1: number, v2: number) {
        const i = this.length;
        this.resize(i + 1);
        return this.emplace(i, v0, v1, v2);
    }

    emplace(i: number, v0: number, v1: number, v2: number) {
        const o2 = i * 3;
        this.uint16[o2 + 0] = v0;
        this.uint16[o2 + 1] = v1;
        this.uint16[o2 + 2] = v2;
        return i;
    }
}

StructArrayLayout3ui6.prototype.bytesPerElement = 6;
register('StructArrayLayout3ui6', StructArrayLayout3ui6);

/**
 * Implementation of the StructArray layout:
 * [0]: Int16[2]
 * [4]: Uint16[2]
 * [8]: Uint32[3]
 * [20]: Uint16[3]
 * [28]: Float32[2]
 * [36]: Uint8[3]
 * [40]: Uint32[1]
 * [44]: Int16[1]
 *
 * @private
 */
class StructArrayLayout2i2ui3ul3ui2f3ub1ul1i48 extends StructArray {
    uint8: Uint8Array;
    int16: Int16Array;
    uint16: Uint16Array;
    uint32: Uint32Array;
    float32: Float32Array;

    _refreshViews() {
        this.uint8 = new Uint8Array(this.arrayBuffer);
        this.int16 = new Int16Array(this.arrayBuffer);
        this.uint16 = new Uint16Array(this.arrayBuffer);
        this.uint32 = new Uint32Array(this.arrayBuffer);
        this.float32 = new Float32Array(this.arrayBuffer);
    }

    emplaceBack(v0: number, v1: number, v2: number, v3: number, v4: number, v5: number, v6: number, v7: number, v8: number, v9: number, v10: number, v11: number, v12: number, v13: number, v14: number, v15: number, v16: number) {
        const i = this.length;
        this.resize(i + 1);
        return this.emplace(i, v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15, v16);
    }

    emplace(i: number, v0: number, v1: number, v2: number, v3: number, v4: number, v5: number, v6: number, v7: number, v8: number, v9: number, v10: number, v11: number, v12: number, v13: number, v14: number, v15: number, v16: number) {
        const o2 = i * 24;
        const o4 = i * 12;
        const o1 = i * 48;
        this.int16[o2 + 0] = v0;
        this.int16[o2 + 1] = v1;
        this.uint16[o2 + 2] = v2;
        this.uint16[o2 + 3] = v3;
        this.uint32[o4 + 2] = v4;
        this.uint32[o4 + 3] = v5;
        this.uint32[o4 + 4] = v6;
        this.uint16[o2 + 10] = v7;
        this.uint16[o2 + 11] = v8;
        this.uint16[o2 + 12] = v9;
        this.float32[o4 + 7] = v10;
        this.float32[o4 + 8] = v11;
        this.uint8[o1 + 36] = v12;
        this.uint8[o1 + 37] = v13;
        this.uint8[o1 + 38] = v14;
        this.uint32[o4 + 10] = v15;
        this.int16[o2 + 22] = v16;
        return i;
    }
}

StructArrayLayout2i2ui3ul3ui2f3ub1ul1i48.prototype.bytesPerElement = 48;
register('StructArrayLayout2i2ui3ul3ui2f3ub1ul1i48', StructArrayLayout2i2ui3ul3ui2f3ub1ul1i48);

/**
 * Implementation of the StructArray layout:
 * [0]: Int16[8]
 * [16]: Uint16[15]
 * [48]: Uint32[1]
 * [52]: Float32[3]
 *
 * @private
 */
class StructArrayLayout8i15ui1ul3f64 extends StructArray {
    uint8: Uint8Array;
    int16: Int16Array;
    uint16: Uint16Array;
    uint32: Uint32Array;
    float32: Float32Array;

    _refreshViews() {
        this.uint8 = new Uint8Array(this.arrayBuffer);
        this.int16 = new Int16Array(this.arrayBuffer);
        this.uint16 = new Uint16Array(this.arrayBuffer);
        this.uint32 = new Uint32Array(this.arrayBuffer);
        this.float32 = new Float32Array(this.arrayBuffer);
    }

    emplaceBack(v0: number, v1: number, v2: number, v3: number, v4: number, v5: number, v6: number, v7: number, v8: number, v9: number, v10: number, v11: number, v12: number, v13: number, v14: number, v15: number, v16: number, v17: number, v18: number, v19: number, v20: number, v21: number, v22: number, v23: number, v24: number, v25: number, v26: number) {
        const i = this.length;
        this.resize(i + 1);
        return this.emplace(i, v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15, v16, v17, v18, v19, v20, v21, v22, v23, v24, v25, v26);
    }

    emplace(i: number, v0: number, v1: number, v2: number, v3: number, v4: number, v5: number, v6: number, v7: number, v8: number, v9: number, v10: number, v11: number, v12: number, v13: number, v14: number, v15: number, v16: number, v17: number, v18: number, v19: number, v20: number, v21: number, v22: number, v23: number, v24: number, v25: number, v26: number) {
        const o2 = i * 32;
        const o4 = i * 16;
        this.int16[o2 + 0] = v0;
        this.int16[o2 + 1] = v1;
        this.int16[o2 + 2] = v2;
        this.int16[o2 + 3] = v3;
        this.int16[o2 + 4] = v4;
        this.int16[o2 + 5] = v5;
        this.int16[o2 + 6] = v6;
        this.int16[o2 + 7] = v7;
        this.uint16[o2 + 8] = v8;
        this.uint16[o2 + 9] = v9;
        this.uint16[o2 + 10] = v10;
        this.uint16[o2 + 11] = v11;
        this.uint16[o2 + 12] = v12;
        this.uint16[o2 + 13] = v13;
        this.uint16[o2 + 14] = v14;
        this.uint16[o2 + 15] = v15;
        this.uint16[o2 + 16] = v16;
        this.uint16[o2 + 17] = v17;
        this.uint16[o2 + 18] = v18;
        this.uint16[o2 + 19] = v19;
        this.uint16[o2 + 20] = v20;
        this.uint16[o2 + 21] = v21;
        this.uint16[o2 + 22] = v22;
        this.uint32[o4 + 12] = v23;
        this.float32[o4 + 13] = v24;
        this.float32[o4 + 14] = v25;
        this.float32[o4 + 15] = v26;
        return i;
    }
}

StructArrayLayout8i15ui1ul3f64.prototype.bytesPerElement = 64;
register('StructArrayLayout8i15ui1ul3f64', StructArrayLayout8i15ui1ul3f64);

/**
 * Implementation of the StructArray layout:
 * [0]: Float32[1]
 *
 * @private
 */
class StructArrayLayout1f4 extends StructArray {
    uint8: Uint8Array;
    float32: Float32Array;

    _refreshViews() {
        this.uint8 = new Uint8Array(this.arrayBuffer);
        this.float32 = new Float32Array(this.arrayBuffer);
    }

    emplaceBack(v0: number) {
        const i = this.length;
        this.resize(i + 1);
        return this.emplace(i, v0);
    }

    emplace(i: number, v0: number) {
        const o4 = i * 1;
        this.float32[o4 + 0] = v0;
        return i;
    }
}

StructArrayLayout1f4.prototype.bytesPerElement = 4;
register('StructArrayLayout1f4', StructArrayLayout1f4);

/**
 * Implementation of the StructArray layout:
 * [0]: Int16[3]
 *
 * @private
 */
class StructArrayLayout3i6 extends StructArray {
    uint8: Uint8Array;
    int16: Int16Array;

    _refreshViews() {
        this.uint8 = new Uint8Array(this.arrayBuffer);
        this.int16 = new Int16Array(this.arrayBuffer);
    }

    emplaceBack(v0: number, v1: number, v2: number) {
        const i = this.length;
        this.resize(i + 1);
        return this.emplace(i, v0, v1, v2);
    }

    emplace(i: number, v0: number, v1: number, v2: number) {
        const o2 = i * 3;
        this.int16[o2 + 0] = v0;
        this.int16[o2 + 1] = v1;
        this.int16[o2 + 2] = v2;
        return i;
    }
}

StructArrayLayout3i6.prototype.bytesPerElement = 6;
register('StructArrayLayout3i6', StructArrayLayout3i6);

/**
 * Implementation of the StructArray layout:
 * [0]: Uint32[1]
 * [4]: Uint16[3]
 *
 * @private
 */
class StructArrayLayout1ul3ui12 extends StructArray {
    uint8: Uint8Array;
    uint32: Uint32Array;
    uint16: Uint16Array;

    _refreshViews() {
        this.uint8 = new Uint8Array(this.arrayBuffer);
        this.uint32 = new Uint32Array(this.arrayBuffer);
        this.uint16 = new Uint16Array(this.arrayBuffer);
    }

    emplaceBack(v0: number, v1: number, v2: number, v3: number) {
        const i = this.length;
        this.resize(i + 1);
        return this.emplace(i, v0, v1, v2, v3);
    }

    emplace(i: number, v0: number, v1: number, v2: number, v3: number) {
        const o4 = i * 3;
        const o2 = i * 6;
        this.uint32[o4 + 0] = v0;
        this.uint16[o2 + 2] = v1;
        this.uint16[o2 + 3] = v2;
        this.uint16[o2 + 4] = v3;
        return i;
    }
}

StructArrayLayout1ul3ui12.prototype.bytesPerElement = 12;
register('StructArrayLayout1ul3ui12', StructArrayLayout1ul3ui12);

/**
 * Implementation of the StructArray layout:
 * [0]: Uint16[2]
 *
 * @private
 */
class StructArrayLayout2ui4 extends StructArray {
    uint8: Uint8Array;
    uint16: Uint16Array;

    _refreshViews() {
        this.uint8 = new Uint8Array(this.arrayBuffer);
        this.uint16 = new Uint16Array(this.arrayBuffer);
    }

    emplaceBack(v0: number, v1: number) {
        const i = this.length;
        this.resize(i + 1);
        return this.emplace(i, v0, v1);
    }

    emplace(i: number, v0: number, v1: number) {
        const o2 = i * 2;
        this.uint16[o2 + 0] = v0;
        this.uint16[o2 + 1] = v1;
        return i;
    }
}

StructArrayLayout2ui4.prototype.bytesPerElement = 4;
register('StructArrayLayout2ui4', StructArrayLayout2ui4);

/**
 * Implementation of the StructArray layout:
 * [0]: Uint16[1]
 *
 * @private
 */
class StructArrayLayout1ui2 extends StructArray {
    uint8: Uint8Array;
    uint16: Uint16Array;

    _refreshViews() {
        this.uint8 = new Uint8Array(this.arrayBuffer);
        this.uint16 = new Uint16Array(this.arrayBuffer);
    }

    emplaceBack(v0: number) {
        const i = this.length;
        this.resize(i + 1);
        return this.emplace(i, v0);
    }

    emplace(i: number, v0: number) {
        const o2 = i * 1;
        this.uint16[o2 + 0] = v0;
        return i;
    }
}

StructArrayLayout1ui2.prototype.bytesPerElement = 2;
register('StructArrayLayout1ui2', StructArrayLayout1ui2);

/**
 * Implementation of the StructArray layout:
 * [0]: Float32[4]
 *
 * @private
 */
class StructArrayLayout4f16 extends StructArray {
    uint8: Uint8Array;
    float32: Float32Array;

    _refreshViews() {
        this.uint8 = new Uint8Array(this.arrayBuffer);
        this.float32 = new Float32Array(this.arrayBuffer);
    }

    emplaceBack(v0: number, v1: number, v2: number, v3: number) {
        const i = this.length;
        this.resize(i + 1);
        return this.emplace(i, v0, v1, v2, v3);
    }

    emplace(i: number, v0: number, v1: number, v2: number, v3: number) {
        const o4 = i * 4;
        this.float32[o4 + 0] = v0;
        this.float32[o4 + 1] = v1;
        this.float32[o4 + 2] = v2;
        this.float32[o4 + 3] = v3;
        return i;
    }
}

StructArrayLayout4f16.prototype.bytesPerElement = 16;
register('StructArrayLayout4f16', StructArrayLayout4f16);

class CollisionBoxStruct extends Struct {
    _structArray: CollisionBoxArray;
    anchorPointX: number;
    anchorPointY: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    padding: number;
    featureIndex: number;
    sourceLayerIndex: number;
    bucketIndex: number;
    anchorPoint: Point;
    get anchorPointX() { return this._structArray.int16[this._pos2 + 0]; }
    get anchorPointY() { return this._structArray.int16[this._pos2 + 1]; }
    get x1() { return this._structArray.float32[this._pos4 + 1]; }
    get y1() { return this._structArray.float32[this._pos4 + 2]; }
    get x2() { return this._structArray.float32[this._pos4 + 3]; }
    get y2() { return this._structArray.float32[this._pos4 + 4]; }
    get padding() { return this._structArray.int16[this._pos2 + 10]; }
    get featureIndex() { return this._structArray.uint32[this._pos4 + 6]; }
    get sourceLayerIndex() { return this._structArray.uint16[this._pos2 + 14]; }
    get bucketIndex() { return this._structArray.uint16[this._pos2 + 15]; }
    get anchorPoint() { return new Point(this.anchorPointX, this.anchorPointY); }
}

CollisionBoxStruct.prototype.size = 32;

export type CollisionBox = CollisionBoxStruct;

/**
 * @private
 */
export class CollisionBoxArray extends StructArrayLayout2i4f1i1ul2ui32 {
    /**
     * Return the CollisionBoxStruct at the given location in the array.
     * @param {number} index The index of the element.
     * @private
     */
    get(index: number): CollisionBoxStruct {
        assert(!this.isTransferred);
        return new CollisionBoxStruct(this, index);
    }
}

register('CollisionBoxArray', CollisionBoxArray);

class PlacedSymbolStruct extends Struct {
    _structArray: PlacedSymbolArray;
    anchorX: number;
    anchorY: number;
    glyphStartIndex: number;
    numGlyphs: number;
    vertexStartIndex: number;
    lineStartIndex: number;
    lineLength: number;
    segment: number;
    lowerSize: number;
    upperSize: number;
    lineOffsetX: number;
    lineOffsetY: number;
    writingMode: number;
    placedOrientation: number;
    hidden: number;
    crossTileID: number;
    associatedIconIndex: number;
    get anchorX() { return this._structArray.int16[this._pos2 + 0]; }
    get anchorY() { return this._structArray.int16[this._pos2 + 1]; }
    get glyphStartIndex() { return this._structArray.uint16[this._pos2 + 2]; }
    get numGlyphs() { return this._structArray.uint16[this._pos2 + 3]; }
    get vertexStartIndex() { return this._structArray.uint32[this._pos4 + 2]; }
    get lineStartIndex() { return this._structArray.uint32[this._pos4 + 3]; }
    get lineLength() { return this._structArray.uint32[this._pos4 + 4]; }
    get segment() { return this._structArray.uint16[this._pos2 + 10]; }
    get lowerSize() { return this._structArray.uint16[this._pos2 + 11]; }
    get upperSize() { return this._structArray.uint16[this._pos2 + 12]; }
    get lineOffsetX() { return this._structArray.float32[this._pos4 + 7]; }
    get lineOffsetY() { return this._structArray.float32[this._pos4 + 8]; }
    get writingMode() { return this._structArray.uint8[this._pos1 + 36]; }
    get placedOrientation() { return this._structArray.uint8[this._pos1 + 37]; }
    set placedOrientation(x: number) { this._structArray.uint8[this._pos1 + 37] = x; }
    get hidden() { return this._structArray.uint8[this._pos1 + 38]; }
    set hidden(x: number) { this._structArray.uint8[this._pos1 + 38] = x; }
    get crossTileID() { return this._structArray.uint32[this._pos4 + 10]; }
    set crossTileID(x: number) { this._structArray.uint32[this._pos4 + 10] = x; }
    get associatedIconIndex() { return this._structArray.int16[this._pos2 + 22]; }
}

PlacedSymbolStruct.prototype.size = 48;

export type PlacedSymbol = PlacedSymbolStruct;

/**
 * @private
 */
export class PlacedSymbolArray extends StructArrayLayout2i2ui3ul3ui2f3ub1ul1i48 {
    /**
     * Return the PlacedSymbolStruct at the given location in the array.
     * @param {number} index The index of the element.
     * @private
     */
    get(index: number): PlacedSymbolStruct {
        assert(!this.isTransferred);
        return new PlacedSymbolStruct(this, index);
    }
}

register('PlacedSymbolArray', PlacedSymbolArray);

class SymbolInstanceStruct extends Struct {
    _structArray: SymbolInstanceArray;
    anchorX: number;
    anchorY: number;
    rightJustifiedTextSymbolIndex: number;
    centerJustifiedTextSymbolIndex: number;
    leftJustifiedTextSymbolIndex: number;
    verticalPlacedTextSymbolIndex: number;
    placedIconSymbolIndex: number;
    verticalPlacedIconSymbolIndex: number;
    key: number;
    textBoxStartIndex: number;
    textBoxEndIndex: number;
    verticalTextBoxStartIndex: number;
    verticalTextBoxEndIndex: number;
    iconBoxStartIndex: number;
    iconBoxEndIndex: number;
    verticalIconBoxStartIndex: number;
    verticalIconBoxEndIndex: number;
    featureIndex: number;
    numHorizontalGlyphVertices: number;
    numVerticalGlyphVertices: number;
    numIconVertices: number;
    numVerticalIconVertices: number;
    useRuntimeCollisionCircles: number;
    crossTileID: number;
    textOffset0: number;
    textOffset1: number;
    collisionCircleDiameter: number;
    get anchorX() { return this._structArray.int16[this._pos2 + 0]; }
    get anchorY() { return this._structArray.int16[this._pos2 + 1]; }
    get rightJustifiedTextSymbolIndex() { return this._structArray.int16[this._pos2 + 2]; }
    get centerJustifiedTextSymbolIndex() { return this._structArray.int16[this._pos2 + 3]; }
    get leftJustifiedTextSymbolIndex() { return this._structArray.int16[this._pos2 + 4]; }
    get verticalPlacedTextSymbolIndex() { return this._structArray.int16[this._pos2 + 5]; }
    get placedIconSymbolIndex() { return this._structArray.int16[this._pos2 + 6]; }
    get verticalPlacedIconSymbolIndex() { return this._structArray.int16[this._pos2 + 7]; }
    get key() { return this._structArray.uint16[this._pos2 + 8]; }
    get textBoxStartIndex() { return this._structArray.uint16[this._pos2 + 9]; }
    get textBoxEndIndex() { return this._structArray.uint16[this._pos2 + 10]; }
    get verticalTextBoxStartIndex() { return this._structArray.uint16[this._pos2 + 11]; }
    get verticalTextBoxEndIndex() { return this._structArray.uint16[this._pos2 + 12]; }
    get iconBoxStartIndex() { return this._structArray.uint16[this._pos2 + 13]; }
    get iconBoxEndIndex() { return this._structArray.uint16[this._pos2 + 14]; }
    get verticalIconBoxStartIndex() { return this._structArray.uint16[this._pos2 + 15]; }
    get verticalIconBoxEndIndex() { return this._structArray.uint16[this._pos2 + 16]; }
    get featureIndex() { return this._structArray.uint16[this._pos2 + 17]; }
    get numHorizontalGlyphVertices() { return this._structArray.uint16[this._pos2 + 18]; }
    get numVerticalGlyphVertices() { return this._structArray.uint16[this._pos2 + 19]; }
    get numIconVertices() { return this._structArray.uint16[this._pos2 + 20]; }
    get numVerticalIconVertices() { return this._structArray.uint16[this._pos2 + 21]; }
    get useRuntimeCollisionCircles() { return this._structArray.uint16[this._pos2 + 22]; }
    get crossTileID() { return this._structArray.uint32[this._pos4 + 12]; }
    set crossTileID(x: number) { this._structArray.uint32[this._pos4 + 12] = x; }
    get textOffset0() { return this._structArray.float32[this._pos4 + 13]; }
    get textOffset1() { return this._structArray.float32[this._pos4 + 14]; }
    get collisionCircleDiameter() { return this._structArray.float32[this._pos4 + 15]; }
}

SymbolInstanceStruct.prototype.size = 64;

export type SymbolInstance = SymbolInstanceStruct;

/**
 * @private
 */
export class SymbolInstanceArray extends StructArrayLayout8i15ui1ul3f64 {
    /**
     * Return the SymbolInstanceStruct at the given location in the array.
     * @param {number} index The index of the element.
     * @private
     */
    get(index: number): SymbolInstanceStruct {
        assert(!this.isTransferred);
        return new SymbolInstanceStruct(this, index);
    }
}

register('SymbolInstanceArray', SymbolInstanceArray);

/**
 * @private
 */
export class GlyphOffsetArray extends StructArrayLayout1f4 {
    getoffsetX(index: number) { return this.float32[index * 1 + 0]; }
}

register('GlyphOffsetArray', GlyphOffsetArray);

/**
 * @private
 */
export class SymbolLineVertexArray extends StructArrayLayout3i6 {
    getx(index: number) { return this.int16[index * 3 + 0]; }
    gety(index: number) { return this.int16[index * 3 + 1]; }
    gettileUnitDistanceFromAnchor(index: number) { return this.int16[index * 3 + 2]; }
}

register('SymbolLineVertexArray', SymbolLineVertexArray);

class FeatureIndexStruct extends Struct {
    _structArray: FeatureIndexArray;
    featureIndex: number;
    sourceLayerIndex: number;
    bucketIndex: number;
    layoutVertexArrayOffset: number;
    get featureIndex() { return this._structArray.uint32[this._pos4 + 0]; }
    get sourceLayerIndex() { return this._structArray.uint16[this._pos2 + 2]; }
    get bucketIndex() { return this._structArray.uint16[this._pos2 + 3]; }
    get layoutVertexArrayOffset() { return this._structArray.uint16[this._pos2 + 4]; }
}

FeatureIndexStruct.prototype.size = 12;

export type FeatureIndex = FeatureIndexStruct;

/**
 * @private
 */
export class FeatureIndexArray extends StructArrayLayout1ul3ui12 {
    /**
     * Return the FeatureIndexStruct at the given location in the array.
     * @param {number} index The index of the element.
     * @private
     */
    get(index: number): FeatureIndexStruct {
        assert(!this.isTransferred);
        return new FeatureIndexStruct(this, index);
    }
}

register('FeatureIndexArray', FeatureIndexArray);

class FillExtrusionCentroidStruct extends Struct {
    _structArray: FillExtrusionCentroidArray;
    a_centroid_pos0: number;
    a_centroid_pos1: number;
    get a_centroid_pos0() { return this._structArray.uint16[this._pos2 + 0]; }
    get a_centroid_pos1() { return this._structArray.uint16[this._pos2 + 1]; }
}

FillExtrusionCentroidStruct.prototype.size = 4;

export type FillExtrusionCentroid = FillExtrusionCentroidStruct;

/**
 * @private
 */
export class FillExtrusionCentroidArray extends StructArrayLayout2ui4 {
    /**
     * Return the FillExtrusionCentroidStruct at the given location in the array.
     * @param {number} index The index of the element.
     * @private
     */
    get(index: number): FillExtrusionCentroidStruct {
        assert(!this.isTransferred);
        return new FillExtrusionCentroidStruct(this, index);
    }
}

register('FillExtrusionCentroidArray', FillExtrusionCentroidArray);

export {
    StructArrayLayout2i4,
    StructArrayLayout4i8,
    StructArrayLayout2i4ub1f12,
    StructArrayLayout2f8,
    StructArrayLayout10ui20,
    StructArrayLayout8ui16,
    StructArrayLayout4i4ui4i24,
    StructArrayLayout3f12,
    StructArrayLayout1ul4,
    StructArrayLayout2i4f1i1ul2ui32,
    StructArrayLayout2i2i2i12,
    StructArrayLayout2f1f2i16,
    StructArrayLayout2ub2f12,
    StructArrayLayout3ui6,
    StructArrayLayout2i2ui3ul3ui2f3ub1ul1i48,
    StructArrayLayout8i15ui1ul3f64,
    StructArrayLayout1f4,
    StructArrayLayout3i6,
    StructArrayLayout1ul3ui12,
    StructArrayLayout2ui4,
    StructArrayLayout1ui2,
    StructArrayLayout4f16,
    StructArrayLayout2i4 as PosArray,
    StructArrayLayout4i8 as RasterBoundsArray,
    StructArrayLayout2i4 as CircleLayoutArray,
    StructArrayLayout2i4 as FillLayoutArray,
    StructArrayLayout4i8 as FillExtrusionLayoutArray,
    StructArrayLayout2i4 as HeatmapLayoutArray,
    StructArrayLayout2i4ub1f12 as LineLayoutArray,
    StructArrayLayout2f8 as LineExtLayoutArray,
    StructArrayLayout10ui20 as PatternLayoutArray,
    StructArrayLayout8ui16 as DashLayoutArray,
    StructArrayLayout4i4ui4i24 as SymbolLayoutArray,
    StructArrayLayout3f12 as SymbolDynamicLayoutArray,
    StructArrayLayout1ul4 as SymbolOpacityArray,
    StructArrayLayout2i2i2i12 as CollisionBoxLayoutArray,
    StructArrayLayout2f1f2i16 as CollisionCircleLayoutArray,
    StructArrayLayout2ub2f12 as CollisionVertexArray,
    StructArrayLayout3f12 as CollisionVertexExtArray,
    StructArrayLayout3ui6 as QuadTriangleArray,
    StructArrayLayout3ui6 as TriangleIndexArray,
    StructArrayLayout2ui4 as LineIndexArray,
    StructArrayLayout1ui2 as LineStripIndexArray,
    StructArrayLayout3f12 as SkyboxVertexArray
};
