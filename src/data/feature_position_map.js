// @flow

import murmur3 from 'murmurhash-js';
import {register} from '../util/web_worker_transfer.js';
import {MAX_SAFE_INTEGER} from '../util/util.js';
import assert from 'assert';

type SerializedFeaturePositionMap = {
    ids: Float64Array;
    positions: Uint32Array;
};

type FeaturePosition = {
    index: number;
    start: number;
    end: number;
};

// A transferable data structure that maps feature ids to their indices and buffer offsets
export default class FeaturePositionMap {
    ids: Array<number>;
    positions: Array<number>;
    indexed: boolean;

    constructor() {
        this.ids = [];
        this.positions = [];
        this.indexed = false;
    }

    add(id: mixed, index: number, start: number, end: number) {
        this.ids.push(getNumericId(id));
        this.positions.push(index, start, end);
    }

    getPositions(id: mixed): Array<FeaturePosition> {
        assert(this.indexed);

        const intId = getNumericId(id);

        // binary search for the first occurrence of id in this.ids;
        // relies on ids/positions being sorted by id, which happens in serialization
        let i = 0;
        let j = this.ids.length - 1;
        while (i < j) {
            const m = (i + j) >> 1;
            if (this.ids[m] >= intId) {
                j = m;
            } else {
                i = m + 1;
            }
        }
        const positions = [];
        while (this.ids[i] === intId) {
            const index = this.positions[3 * i];
            const start = this.positions[3 * i + 1];
            const end = this.positions[3 * i + 2];
            positions.push({index, start, end});
            i++;
        }
        return positions;
    }

    static serialize(map: FeaturePositionMap, transferables: Array<ArrayBuffer>): SerializedFeaturePositionMap {
        const ids = new Float64Array(map.ids);
        const positions = new Uint32Array(map.positions);

        sort(ids, positions, 0, ids.length - 1);

        if (transferables) {
            transferables.push(ids.buffer, positions.buffer);
        }

        return {ids, positions};
    }

    static deserialize(obj: SerializedFeaturePositionMap): FeaturePositionMap {
        const map = new FeaturePositionMap();
        // after transferring, we only use these arrays statically (no pushes),
        // so TypedArray vs Array distinction that flow points out doesn't matter
        map.ids = (obj.ids: any);
        map.positions = (obj.positions: any);
        map.indexed = true;
        return map;
    }
}

function getNumericId(value: mixed) {
    const numValue = +value;
    if (!isNaN(numValue) && numValue <= MAX_SAFE_INTEGER) {
        return numValue;
    }
    return murmur3(String(value));
}

// custom quicksort that sorts ids, indices and offsets together (by ids)
// uses Hoare partitioning & manual tail call optimization to avoid worst case scenarios
function sort(ids, positions, left, right) {
    while (left < right) {
        const pivot = ids[(left + right) >> 1];
        let i = left - 1;
        let j = right + 1;

        while (true) {
            do i++; while (ids[i] < pivot);
            do j--; while (ids[j] > pivot);
            if (i >= j) break;
            swap(ids, i, j);
            swap(positions, 3 * i, 3 * j);
            swap(positions, 3 * i + 1, 3 * j + 1);
            swap(positions, 3 * i + 2, 3 * j + 2);
        }

        if (j - left < right - j) {
            sort(ids, positions, left, j);
            left = j + 1;
        } else {
            sort(ids, positions, j + 1, right);
            right = j;
        }
    }
}

function swap(arr, i, j) {
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
}

register('FeaturePositionMap', FeaturePositionMap);
