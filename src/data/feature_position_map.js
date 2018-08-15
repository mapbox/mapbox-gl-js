// @flow

import { register } from '../util/web_worker_transfer';

type SerializedFeaturePositionMap = {
    ids: Float64Array;
    indices: Uint32Array;
    offsets: Uint16Array;
};

type FeaturePosition = {
    index: number;
    start: number;
    end: number;
};

// A transferable data structure that maps feature ids to their indices and buffer offsets
export default class FeaturePositionMap {
    ids: Array<number>;
    indices: Array<number>;
    offsets: Array<number>;
    _bufferLen: number;

    constructor() {
        this.ids = [];
        this.indices = [];
        this.offsets = [];
        this._bufferLen = 0;
    }

    add(id: number, index: number, newLength: number) {
        this.ids.push(id);
        this.indices.push(index);
        this.offsets.push(this._bufferLen, newLength);
        this._bufferLen = newLength;
    }

    getPositions(id: number): Array<FeaturePosition> {
        // binary search for the first occurrence of id in this.ids
        let i = 0;
        let j = this.ids.length - 1;
        while (i < j) {
            const m = (i + j) >> 1;
            if (this.ids[m] >= id) {
                j = m;
            } else {
                i = m + 1;
            }
        }
        const positions = [];
        while (this.ids[i] === id) {
            const index = this.indices[i];
            const start = this.offsets[2 * i];
            const end = this.offsets[2 * i + 1];
            positions.push({index, start, end});
            i++;
        }
        return positions;
    }

    static serialize(map: FeaturePositionMap, transferables: Array<ArrayBuffer>): SerializedFeaturePositionMap {
        const ids = new Float64Array(map.ids);
        const indices = new Uint32Array(map.indices);
        const offsets = new Uint16Array(map.offsets);

        sort(ids, indices, offsets, 0, ids.length - 1);

        transferables.push(ids.buffer, indices.buffer, offsets.buffer);

        return {ids, indices, offsets};
    }

    static deserialize(obj: SerializedFeaturePositionMap): FeaturePositionMap {
        const map = new FeaturePositionMap();
        // after transferring, we only use these arrays statically (no pushes),
        // so TypedArray vs Array distinction that flow points out doesn't matter
        map.ids = (obj.ids: any);
        map.indices = (obj.indices: any);
        map.offsets = (obj.offsets: any);
        return map;
    }
}

// custom quicksort that sorts ids, indices and offsets together (by ids)
function sort(ids, indices, offsets, left, right) {
    if (left >= right) return;

    const pivot = ids[(left + right) >> 1];
    let i = left - 1;
    let j = right + 1;

    while (true) {
        do i++; while (ids[i] < pivot);
        do j--; while (ids[j] > pivot);
        if (i >= j) break;
        swap(ids, i, j);
        swap(indices, i, j);
        swap(offsets, 2 * i, 2 * j);
        swap(offsets, 2 * i + 1, 2 * j + 1);
    }

    sort(ids, indices, offsets, left, j);
    sort(ids, indices, offsets, j + 1, right);
}

function swap(arr, i, j) {
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
}

register('FeaturePositionMap', FeaturePositionMap);
