import { test } from 'mapbox-gl-js-test';
import Point from '@mapbox/point-geometry';
import findPoleOfInaccessibility from '../../../src/util/find_pole_of_inaccessibility';

test('polygon_poi', (t) => {

    const closedRing = [
        new Point(0, 0),
        new Point(10, 10),
        new Point(10, 0),
        new Point(0, 0)
    ];
    const closedRingHole = [
        new Point(2, 1),
        new Point(6, 6),
        new Point(6, 1),
        new Point(2, 1)
    ];
    t.deepEqual(findPoleOfInaccessibility([closedRing], 0.1), new Point(7.0703125, 2.9296875));
    t.deepEqual(findPoleOfInaccessibility([closedRing, closedRingHole], 0.1), new Point(7.96875, 2.03125));

    t.end();
});
