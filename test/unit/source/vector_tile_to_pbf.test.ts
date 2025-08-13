// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, waitFor, vi, doneAsync} from '../../util/vitest';
import writePbf from '../../../src/source/vector_tile_to_pbf';

test('loadData does not error on non-numeric feature IDs', () => {
    const features = [{
        id: "41e1195014088091",
        type: 1,
        geometry: [[0, 0]]
    }, {
        id: "-Infinity",
        type: 1,
        geometry: [[0, 0]]
    }, {
        id: "NaN",
        type: 1,
        geometry: [[0, 0]]
    }];

    expect(() => {
        writePbf({test: features});
    }).not.toThrowError();
});
