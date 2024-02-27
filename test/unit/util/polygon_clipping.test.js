import {describe, test, expect} from "../../util/vitest.js";
import {subdividePolygons} from '../../../src/util/polygon_clipping.js';
import Point from '@mapbox/point-geometry';

function convertToCollection(polygon) {
    const collection = [];
    collection.push(polygon);
    return collection;
}

describe('polygon clipping', () => {
    test('no clip', () => {
        const outerBoxRing = [new Point(-5, -5), new Point(-5, 5), new Point(5, 5), new Point(5, -5), new Point(-5, -5)];
        const bounds = [new Point(-10, -10), new Point(10, 10)];
        let clippedPolygons = subdividePolygons(convertToCollection([outerBoxRing]), bounds, 1, 1);

        expect(clippedPolygons.length).toEqual(1);
        expect(bounds).toEqual(clippedPolygons[0].bounds);
        expect(clippedPolygons[0].polygon.length).toEqual(1);
        expect(outerBoxRing).toEqual(clippedPolygons[0].polygon[0]);

        const innerBoxRing = [new Point(-2, -2), new Point(-2, 2), new Point(2, 2), new Point(2, -2), new Point(-2, -2)];
        clippedPolygons = subdividePolygons(convertToCollection([outerBoxRing, innerBoxRing]), bounds, 1, 1);

        expect(1).toEqual(clippedPolygons.length);
        expect(bounds).toEqual(clippedPolygons[0].bounds);
        expect(2).toEqual(clippedPolygons[0].polygon.length);
        expect(outerBoxRing).toEqual(clippedPolygons[0].polygon[0]);
        expect(innerBoxRing).toEqual(clippedPolygons[0].polygon[1]);
    });

    test('trivial clip', () => {
        const boxRing = [new Point(-5, -5), new Point(-5, 5), new Point(5, 5), new Point(5, -5), new Point(-5, -5)];
        const bounds = [new Point(10, 0), new Point(20, 10)];

        const clippedPolygons = subdividePolygons(convertToCollection([boxRing]), bounds, 1, 1);

        expect(0).toEqual(clippedPolygons.length);
    });

    test('trivial clip with subdivision', () => {
        const boxRing = [new Point(1, 1), new Point(5, 1), new Point(5, 5), new Point(1, 5), new Point(1, 1)];
        const bounds = [new Point(-5, -5), new Point(5, 5)];

        const clippedPolygons = subdividePolygons(convertToCollection([boxRing]), bounds, 2, 2);

        const expectedBounds = [new Point(0, 0), new Point(5, 5)];

        expect(1).toEqual(clippedPolygons.length);
        expect(expectedBounds).toEqual(clippedPolygons[0].bounds);
        expect(1).toEqual(clippedPolygons[0].polygon.length);
        expect(boxRing).toEqual(clippedPolygons[0].polygon[0]);
    });

    test('invalid input', () => {
        // No geometry
        const zeroRing = [];
        let clippedPolygons = subdividePolygons(convertToCollection([zeroRing]), [new Point(-1, -1), new Point(1, 1)], 2, 2);
        expect(0).toEqual(clippedPolygons.length);

        // Invalid bounds
        const boxRing = [new Point(-5, -5), new Point(-5, 5), new Point(5, 5), new Point(5, -5), new Point(-5, -5)];
        clippedPolygons = subdividePolygons(convertToCollection([boxRing]), [new Point(10, 10), new Point(-10, -10)], 2, 2);
        expect(0).toEqual(clippedPolygons.length);

        // Invalid grid size
        clippedPolygons = subdividePolygons(convertToCollection([boxRing]), [new Point(10, 10), new Point(-10, -10)], 1, 0);
        expect(0).toEqual(clippedPolygons.length);
    });

    test('simple subdivision', () => {
        const outerBox = [new Point(1, 1), new Point(9, 1), new Point(9, 9), new Point(1, 9), new Point(1, 1)];
        const innerBox = [new Point(3, 3), new Point(7, 3), new Point(7, 7), new Point(3, 7), new Point(3, 3)];

        // 2x2
        const clippedPolygons = subdividePolygons(convertToCollection([outerBox, innerBox]), [new Point(0, 0), new Point(10, 10)], 2, 2);

        expect(4).toEqual(clippedPolygons.length);
        expect([new Point(5, 0), new Point(10, 5)]).toEqual(clippedPolygons[0].bounds);
        expect([new Point(5, 5), new Point(10, 10)]).toEqual(clippedPolygons[1].bounds);
        expect([new Point(0, 0), new Point(5, 5)]).toEqual(clippedPolygons[2].bounds);
        expect([new Point(0, 5), new Point(5, 10)]).toEqual(clippedPolygons[3].bounds);

        expect(2).toEqual(clippedPolygons[0].polygon.length);
        expect(2).toEqual(clippedPolygons[1].polygon.length);
        expect(2).toEqual(clippedPolygons[2].polygon.length);
        expect(2).toEqual(clippedPolygons[3].polygon.length);

        expect(
            [new Point(5, 1), new Point(9, 1), new Point(9, 5), new Point(5, 5), new Point(5, 1)]
        ).toEqual(clippedPolygons[0].polygon[0]);
        expect(
            [new Point(9, 5), new Point(9, 9), new Point(5, 9), new Point(5, 5), new Point(9, 5)]
        ).toEqual(clippedPolygons[1].polygon[0]);
        expect(
            [new Point(1, 1), new Point(5, 1), new Point(5, 5), new Point(1, 5), new Point(1, 1)]
        ).toEqual(clippedPolygons[2].polygon[0]);
        expect(
            [new Point(5, 5), new Point(5, 9), new Point(1, 9), new Point(1, 5), new Point(5, 5)]
        ).toEqual(clippedPolygons[3].polygon[0]);

        expect(
            [new Point(5, 3), new Point(7, 3), new Point(7, 5), new Point(5, 5), new Point(5, 3)]
        ).toEqual(clippedPolygons[0].polygon[1]);
        expect(
            [new Point(7, 5), new Point(7, 7), new Point(5, 7), new Point(5, 5), new Point(7, 5)]
        ).toEqual(clippedPolygons[1].polygon[1]);
        expect(
            [new Point(3, 3), new Point(5, 3), new Point(5, 5), new Point(3, 5), new Point(3, 3)]
        ).toEqual(clippedPolygons[2].polygon[1]);
        expect(
            [new Point(5, 5), new Point(5, 7), new Point(3, 7), new Point(3, 5), new Point(5, 5)]
        ).toEqual(clippedPolygons[3].polygon[1]);
    });

    test('non-uniform subdivision', () => {
        const box = [new Point(-5, -5), new Point(-5, 5), new Point(5, 5), new Point(5, -5), new Point(-5, -5)];

        // 2x1
        const clippedPolygons = subdividePolygons(convertToCollection([box]), [new Point(-10, -10), new Point(10, 10)], 2, 1);

        expect(2).toEqual(clippedPolygons.length);
        expect([new Point(-10, -10), new Point(0, 10)]).toEqual(clippedPolygons[0].bounds);
        expect([new Point(0, -10), new Point(10, 10)]).toEqual(clippedPolygons[1].bounds);
        expect(1).toEqual(clippedPolygons[0].polygon.length);
        expect(1).toEqual(clippedPolygons[1].polygon.length);

        expect(
            [new Point(-5, -5), new Point(-5, 5), new Point(0, 5), new Point(0, -5), new Point(-5, -5)]
        ).toEqual(clippedPolygons[0].polygon[0]);
        expect(
            [new Point(0, 5), new Point(5, 5), new Point(5, -5), new Point(0, -5), new Point(0, 5)]
        ).toEqual(clippedPolygons[1].polygon[0]);
    });

    test('padding', () => {
        const box = [new Point(-5, -5), new Point(-5, 5), new Point(5, 5), new Point(5, -5), new Point(-5, -5)];

        // Padding
        const clippedPolygons = subdividePolygons(convertToCollection([box]), [new Point(-2, -2), new Point(2, 2)], 1, 1, 1.0);

        expect(1).toEqual(clippedPolygons.length);
        expect([new Point(-2, -2), new Point(2, 2)]).toEqual(clippedPolygons[0].bounds);
        expect(1).toEqual(clippedPolygons[0].polygon.length);
        expect(
            [new Point(-3, 3), new Point(3, 3), new Point(3, -3), new Point(-3, -3), new Point(-3, 3)]
        ).toEqual(clippedPolygons[0].polygon[0]);
    });

    test('custom clip function', () => {
        const box = [new Point(0, 0), new Point(1, 0), new Point(1, 10), new Point(0, 10), new Point(0, 0)];
        const clipFunc = (axis, min, max) => {
            if (axis === 0) {
                return 0.5 * (min + max);
            }

            return 0.75 * min + 0.25 * max;
        };

        const clippedPolygons = subdividePolygons(convertToCollection([box]), [new Point(0, 0), new Point(1, 10)], 1, 4, 0, clipFunc);

        expect(4).toEqual(clippedPolygons.length);
        expect([new Point(0, 2.5), new Point(1, 4.375)]).toEqual(clippedPolygons[0].bounds);
        expect([new Point(0, 4.375), new Point(1, 10.0)]).toEqual(clippedPolygons[1].bounds);
        expect([new Point(0, 0.0), new Point(1, 0.625)]).toEqual(clippedPolygons[2].bounds);
        expect([new Point(0, 0.625), new Point(1, 2.5)]).toEqual(clippedPolygons[3].bounds);
    });
});
