import {test} from '../../util/test.js';
import {subdividePolygons} from '../../../src/util/polygon_clipping.js';
import Point from '@mapbox/point-geometry';

function convertToCollection(polygon) {
    const collection = [];
    collection.push(polygon);
    return collection;
}

test('polygon clipping', (t) => {
    t.test('no clip', (t) => {
        const outerBoxRing = [new Point(-5, -5), new Point(-5, 5), new Point(5, 5), new Point(5, -5), new Point(-5, -5)];
        const bounds = [new Point(-10, -10), new Point(10, 10)];
        let clippedPolygons = subdividePolygons(convertToCollection([outerBoxRing]), bounds, 1, 1);

        t.equal(clippedPolygons.length, 1);
        t.deepEqual(bounds, clippedPolygons[0].bounds);
        t.equal(clippedPolygons[0].polygon.length, 1);
        t.deepEqual(outerBoxRing, clippedPolygons[0].polygon[0]);

        const innerBoxRing = [new Point(-2, -2), new Point(-2, 2), new Point(2, 2), new Point(2, -2), new Point(-2, -2)];
        clippedPolygons = subdividePolygons(convertToCollection([outerBoxRing, innerBoxRing]), bounds, 1, 1);

        t.equal(1, clippedPolygons.length);
        t.deepEqual(bounds, clippedPolygons[0].bounds);
        t.equal(2, clippedPolygons[0].polygon.length);
        t.deepEqual(outerBoxRing, clippedPolygons[0].polygon[0]);
        t.deepEqual(innerBoxRing, clippedPolygons[0].polygon[1]);

        t.end();
    });

    t.test('trivial clip', (t) => {
        const boxRing = [new Point(-5, -5), new Point(-5, 5), new Point(5, 5), new Point(5, -5), new Point(-5, -5)];
        const bounds = [new Point(10, 0), new Point(20, 10)];

        const clippedPolygons = subdividePolygons(convertToCollection([boxRing]), bounds, 1, 1);

        t.equal(0, clippedPolygons.length);

        t.end();
    });

    t.test('trivial clip with subdivision', (t) => {
        const boxRing = [new Point(1, 1), new Point(5, 1), new Point(5, 5), new Point(1, 5), new Point(1, 1)];
        const bounds = [new Point(-5, -5), new Point(5, 5)];

        const clippedPolygons = subdividePolygons(convertToCollection([boxRing]), bounds, 2, 2);

        const expectedBounds = [new Point(0, 0), new Point(5, 5)];

        t.equal(1, clippedPolygons.length);
        t.deepEqual(expectedBounds, clippedPolygons[0].bounds);
        t.equal(1, clippedPolygons[0].polygon.length);
        t.deepEqual(boxRing, clippedPolygons[0].polygon[0]);

        t.end();
    });

    t.test('invalid input', (t) => {
        // No geometry
        const zeroRing = [];
        let clippedPolygons = subdividePolygons(convertToCollection([zeroRing]), [new Point(-1, -1), new Point(1, 1)], 2, 2);
        t.equal(0, clippedPolygons.length);

        // Invalid bounds
        const boxRing = [new Point(-5, -5), new Point(-5, 5), new Point(5, 5), new Point(5, -5), new Point(-5, -5)];
        clippedPolygons = subdividePolygons(convertToCollection([boxRing]), [new Point(10, 10), new Point(-10, -10)], 2, 2);
        t.equal(0, clippedPolygons.length);

        // Invalid grid size
        clippedPolygons = subdividePolygons(convertToCollection([boxRing]), [new Point(10, 10), new Point(-10, -10)], 1, 0);
        t.equal(0, clippedPolygons.length);

        t.end();
    });

    t.test('simple subdivision', (t) => {
        const outerBox = [new Point(1, 1), new Point(9, 1), new Point(9, 9), new Point(1, 9), new Point(1, 1)];
        const innerBox = [new Point(3, 3), new Point(7, 3), new Point(7, 7), new Point(3, 7), new Point(3, 3)];

        // 2x2
        const clippedPolygons = subdividePolygons(convertToCollection([outerBox, innerBox]), [new Point(0, 0), new Point(10, 10)], 2, 2);

        t.equal(4, clippedPolygons.length);
        t.deepEqual([new Point(5, 0), new Point(10, 5)], clippedPolygons[0].bounds);
        t.deepEqual([new Point(5, 5), new Point(10, 10)], clippedPolygons[1].bounds);
        t.deepEqual([new Point(0, 0), new Point(5, 5)], clippedPolygons[2].bounds);
        t.deepEqual([new Point(0, 5), new Point(5, 10)], clippedPolygons[3].bounds);

        t.equal(2, clippedPolygons[0].polygon.length);
        t.equal(2, clippedPolygons[1].polygon.length);
        t.equal(2, clippedPolygons[2].polygon.length);
        t.equal(2, clippedPolygons[3].polygon.length);

        t.deepEqual([new Point(5, 1), new Point(9, 1), new Point(9, 5), new Point(5, 5), new Point(5, 1)], clippedPolygons[0].polygon[0]);
        t.deepEqual([new Point(9, 5), new Point(9, 9), new Point(5, 9), new Point(5, 5), new Point(9, 5)], clippedPolygons[1].polygon[0]);
        t.deepEqual([new Point(1, 1), new Point(5, 1), new Point(5, 5), new Point(1, 5), new Point(1, 1)], clippedPolygons[2].polygon[0]);
        t.deepEqual([new Point(5, 5), new Point(5, 9), new Point(1, 9), new Point(1, 5), new Point(5, 5)], clippedPolygons[3].polygon[0]);

        t.deepEqual([new Point(5, 3), new Point(7, 3), new Point(7, 5), new Point(5, 5), new Point(5, 3)], clippedPolygons[0].polygon[1]);
        t.deepEqual([new Point(7, 5), new Point(7, 7), new Point(5, 7), new Point(5, 5), new Point(7, 5)], clippedPolygons[1].polygon[1]);
        t.deepEqual([new Point(3, 3), new Point(5, 3), new Point(5, 5), new Point(3, 5), new Point(3, 3)], clippedPolygons[2].polygon[1]);
        t.deepEqual([new Point(5, 5), new Point(5, 7), new Point(3, 7), new Point(3, 5), new Point(5, 5)], clippedPolygons[3].polygon[1]);

        t.end();
    });

    t.test('non-uniform subdivision', (t) => {
        const box = [new Point(-5, -5), new Point(-5, 5), new Point(5, 5), new Point(5, -5), new Point(-5, -5)];

        // 2x1
        const clippedPolygons = subdividePolygons(convertToCollection([box]), [new Point(-10, -10), new Point(10, 10)], 2, 1);

        t.equal(2, clippedPolygons.length);
        t.deepEqual([new Point(-10, -10), new Point(0, 10)], clippedPolygons[0].bounds);
        t.deepEqual([new Point(0, -10), new Point(10, 10)], clippedPolygons[1].bounds);
        t.equal(1, clippedPolygons[0].polygon.length);
        t.equal(1, clippedPolygons[1].polygon.length);

        t.deepEqual([new Point(-5, -5), new Point(-5, 5), new Point(0, 5), new Point(0, -5), new Point(-5, -5)], clippedPolygons[0].polygon[0]);
        t.deepEqual([new Point(0, 5), new Point(5, 5), new Point(5, -5), new Point(0, -5), new Point(0, 5)], clippedPolygons[1].polygon[0]);

        t.end();
    });

    t.test('padding', (t) => {
        const box = [new Point(-5, -5), new Point(-5, 5), new Point(5, 5), new Point(5, -5), new Point(-5, -5)];

        // Padding
        const clippedPolygons = subdividePolygons(convertToCollection([box]), [new Point(-2, -2), new Point(2, 2)], 1, 1, 1.0);

        t.equal(1, clippedPolygons.length);
        t.deepEqual([new Point(-2, -2), new Point(2, 2)], clippedPolygons[0].bounds);
        t.equal(1, clippedPolygons[0].polygon.length);
        t.deepEqual([new Point(-3, 3), new Point(3, 3), new Point(3, -3), new Point(-3, -3), new Point(-3, 3)], clippedPolygons[0].polygon[0]);

        t.end();
    });

    t.test('custom clip function', (t) => {
        const box = [new Point(0, 0), new Point(1, 0), new Point(1, 10), new Point(0, 10), new Point(0, 0)];
        const clipFunc = (axis, min, max) => {
            if (axis === 0) {
                return 0.5 * (min + max);
            }

            return 0.75 * min + 0.25 * max;
        };

        const clippedPolygons = subdividePolygons(convertToCollection([box]), [new Point(0, 0), new Point(1, 10)], 1, 4, 0, clipFunc);

        t.equal(4, clippedPolygons.length);
        t.deepEqual([new Point(0, 2.5), new Point(1, 4.375)], clippedPolygons[0].bounds);
        t.deepEqual([new Point(0, 4.375), new Point(1, 10.0)], clippedPolygons[1].bounds);
        t.deepEqual([new Point(0, 0.0), new Point(1, 0.625)], clippedPolygons[2].bounds);
        t.deepEqual([new Point(0, 0.625), new Point(1, 2.5)], clippedPolygons[3].bounds);

        t.end();
    });

    t.end();
});
