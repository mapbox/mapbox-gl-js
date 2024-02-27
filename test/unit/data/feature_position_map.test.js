import {describe, test, expect} from "../../util/vitest.js";

import FeatureMap from '../../../src/data/feature_position_map.js';
import {serialize, deserialize} from '../../../src/util/web_worker_transfer.js';

function getPositions(posMap, id) {
    const positions = [];
    posMap.eachPosition(id, (index, start, end) => {
        positions.push({index, start, end});
    });
    positions.sort((a, b) => a.index - b.index);
    return positions;
}

describe('FeaturePositionMap', () => {
    test('Can be queried after serialization/deserialization', () => {
        const featureMap = new FeatureMap();
        featureMap.add(7, 1, 0, 1);
        featureMap.add(3, 2, 1, 2);
        featureMap.add(7, 3, 2, 3);
        featureMap.add(4, 4, 3, 4);
        featureMap.add(2, 5, 4, 5);
        featureMap.add(7, 6, 5, 7);

        const featureMap2 = deserialize(serialize(featureMap, new Set()));

        expect(getPositions(featureMap2, 7)).toStrictEqual([
            {index: 1, start: 0, end: 1},
            {index: 3, start: 2, end: 3},
            {index: 6, start: 5, end: 7}
        ]);

        expect(featureMap2.uniqueIds).toStrictEqual([2, 3, 4, 7]);
    });

    test('Can not be queried before serialization/deserialization', () => {
        const featureMap = new FeatureMap();
        featureMap.add(0, 1, 2, 3);

        expect(() => {
            featureMap.eachPosition(0, () => {});
        }).toThrowError();
    });

    test('Can be queried with stringified bigint ids', () => {
        const featureMap = new FeatureMap();
        featureMap.add('-9223372036854775808', 0, 0, 0);
        featureMap.add('-9223372036854775807', 1, 1, 1);
        featureMap.add('9223372036854775806', 2, 2, 2);
        featureMap.add('9223372036854775807', 3, 3, 3);

        const featureMap2 = deserialize(serialize(featureMap, new Set()));

        expect(getPositions(featureMap2, '-9223372036854775808')).toStrictEqual([
            {index: 0, start: 0, end: 0},
        ]);

        expect(getPositions(featureMap2, '-9223372036854775807')).toStrictEqual([
            {index: 1, start: 1, end: 1},
        ]);

        expect(getPositions(featureMap2, '9223372036854775806')).toStrictEqual([
            {index: 2, start: 2, end: 2},
        ]);

        expect(getPositions(featureMap2, '9223372036854775807')).toStrictEqual([
            {index: 3, start: 3, end: 3},
        ]);
    });
});
