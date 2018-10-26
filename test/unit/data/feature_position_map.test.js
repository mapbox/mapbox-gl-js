import { test } from 'mapbox-gl-js-test';

import FeatureMap from '../../../src/data/feature_position_map';
import { serialize, deserialize } from '../../../src/util/web_worker_transfer';

test('FeaturePositionMap', (t) => {

    test('Can be queried after serialization/deserialization', (t) => {
        const featureMap = new FeatureMap();
        featureMap.add(7, 1, 0, 1);
        featureMap.add(3, 2, 1, 2);
        featureMap.add(7, 3, 2, 3);
        featureMap.add(4, 4, 3, 4);
        featureMap.add(2, 5, 4, 5);
        featureMap.add(7, 6, 5, 7);

        const featureMap2 = deserialize(serialize(featureMap, []));

        const compareIndex = (a, b) => a.index - b.index;

        t.same(featureMap2.getPositions(7).sort(compareIndex), [
            {index: 1, start: 0, end: 1},
            {index: 3, start: 2, end: 3},
            {index: 6, start: 5, end: 7}
        ].sort(compareIndex));

        t.end();
    });

    test('Can not be queried before serialization/deserialization', (t) => {
        const featureMap = new FeatureMap();
        featureMap.add(0, 1, 2, 3);

        t.throws(() => {
            featureMap.getPositions(0);
        });

        t.end();
    });

    t.end();
});
