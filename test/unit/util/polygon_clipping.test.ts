// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect} from '../../util/vitest';
import {polygonSubdivision, gridSubdivision, clip} from '../../../src/util/polygon_clipping';
import Point from '@mapbox/point-geometry';
import {EdgeIterator} from '../../../3d-style/elevation/elevation_feature';

function convertToCollection(polygon) {
    const collection: Array<any> = [];
    collection.push(polygon);
    return collection;
}

class MockEdgeIterator extends EdgeIterator {
    edges: Array<[Point, Point]>;

    constructor(edges: Array<[Point, Point]>) {
        super(undefined, 0);
        this.edges = edges;
    }

    override get(): [Point, Point] {
        return this.edges[this.index];
    }

    override valid(): boolean {
        return this.index < this.edges.length;
    }
}

declare module 'vitest' {
    interface Assertion<T = any> {
        toMatchRing: (expected: Point[]) => T;
    }
}

function compareRings(actual: Point[], expected: Point[]) {
    if (actual == null || expected == null || actual.length !== expected.length) return false;

    for (let i = 0; i < actual.length; i++) {
        if (!actual[i].equals(expected[i])) return false;
    }

    return true;
}

expect.extend({
    toEqualRing(actual: Point[], expected: Point[]) {
        if (!compareRings(actual, expected)) {
            return {
                message: () => `expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`,
                pass: false
            };
        }

        return {
            message: undefined,
            pass: true
        };
    }
});

describe('polygon clipping', () => {
    test('no clip', () => {
        const outerBoxRing = [new Point(-5, -5), new Point(-5, 5), new Point(5, 5), new Point(5, -5), new Point(-5, -5)];
        const bounds = [new Point(-10, -10), new Point(10, 10)];
        let clippedPolygons = gridSubdivision(convertToCollection([outerBoxRing]), bounds, 1, 1);

        expect(clippedPolygons.length).toEqual(1);
        expect(bounds).toEqual(clippedPolygons[0].bounds);
        expect(clippedPolygons[0].polygon.length).toEqual(1);
        expect(outerBoxRing).toEqual(clippedPolygons[0].polygon[0]);

        const innerBoxRing = [new Point(-2, -2), new Point(-2, 2), new Point(2, 2), new Point(2, -2), new Point(-2, -2)];
        clippedPolygons = gridSubdivision(convertToCollection([outerBoxRing, innerBoxRing]), bounds, 1, 1);

        expect(1).toEqual(clippedPolygons.length);
        expect(bounds).toEqual(clippedPolygons[0].bounds);
        expect(2).toEqual(clippedPolygons[0].polygon.length);
        expect(outerBoxRing).toEqual(clippedPolygons[0].polygon[0]);
        expect(innerBoxRing).toEqual(clippedPolygons[0].polygon[1]);
    });

    test('trivial clip', () => {
        const boxRing = [new Point(-5, -5), new Point(-5, 5), new Point(5, 5), new Point(5, -5), new Point(-5, -5)];
        const bounds = [new Point(10, 0), new Point(20, 10)];

        const clippedPolygons = gridSubdivision(convertToCollection([boxRing]), bounds, 1, 1);

        expect(0).toEqual(clippedPolygons.length);
    });

    test('trivial clip with subdivision', () => {
        const boxRing = [new Point(1, 1), new Point(5, 1), new Point(5, 5), new Point(1, 5), new Point(1, 1)];
        const bounds = [new Point(-5, -5), new Point(5, 5)];

        const clippedPolygons = gridSubdivision(convertToCollection([boxRing]), bounds, 2, 2);

        const expectedBounds = [new Point(0, 0), new Point(5, 5)];

        expect(1).toEqual(clippedPolygons.length);
        expect(expectedBounds).toEqual(clippedPolygons[0].bounds);
        expect(1).toEqual(clippedPolygons[0].polygon.length);
        expect(boxRing).toEqual(clippedPolygons[0].polygon[0]);
    });

    test('invalid input', () => {
        // No geometry
        const zeroRing: Array<any> = [];
        let clippedPolygons = gridSubdivision(convertToCollection([zeroRing]), [new Point(-1, -1), new Point(1, 1)], 2, 2);
        expect(0).toEqual(clippedPolygons.length);

        // Invalid bounds
        const boxRing = [new Point(-5, -5), new Point(-5, 5), new Point(5, 5), new Point(5, -5), new Point(-5, -5)];
        clippedPolygons = gridSubdivision(convertToCollection([boxRing]), [new Point(10, 10), new Point(-10, -10)], 2, 2);
        expect(0).toEqual(clippedPolygons.length);

        // Invalid grid size
        clippedPolygons = gridSubdivision(convertToCollection([boxRing]), [new Point(10, 10), new Point(-10, -10)], 1, 0);
        expect(0).toEqual(clippedPolygons.length);
    });

    test('simple subdivision', () => {
        const outerBox = [new Point(1, 1), new Point(9, 1), new Point(9, 9), new Point(1, 9), new Point(1, 1)];
        const innerBox = [new Point(3, 3), new Point(7, 3), new Point(7, 7), new Point(3, 7), new Point(3, 3)];

        // 2x2
        const clippedPolygons = gridSubdivision(convertToCollection([outerBox, innerBox]), [new Point(0, 0), new Point(10, 10)], 2, 2);

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
        const clippedPolygons = gridSubdivision(convertToCollection([box]), [new Point(-10, -10), new Point(10, 10)], 2, 1);

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
        const clippedPolygons = gridSubdivision(convertToCollection([box]), [new Point(-2, -2), new Point(2, 2)], 1, 1, 1.0);

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

        const clippedPolygons = gridSubdivision(convertToCollection([box]), [new Point(0, 0), new Point(1, 10)], 1, 4, 0, clipFunc);

        expect(4).toEqual(clippedPolygons.length);
        expect([new Point(0, 2.5), new Point(1, 4.375)]).toEqual(clippedPolygons[0].bounds);
        expect([new Point(0, 4.375), new Point(1, 10.0)]).toEqual(clippedPolygons[1].bounds);
        expect([new Point(0, 0.0), new Point(1, 0.625)]).toEqual(clippedPolygons[2].bounds);
        expect([new Point(0, 0.625), new Point(1, 2.5)]).toEqual(clippedPolygons[3].bounds);
    });
});

describe('polygon clipping, simple polygon clipping', () => {
    const subject = [[new Point(2, 2), new Point(6, 2), new Point(6, 6), new Point(2, 6), new Point(2, 2)]];

    test('cut small section', () => {
        const clipPoly = [new Point(3, 1), new Point(5, 1), new Point(5, 3), new Point(3, 3), new Point(3, 1)];

        const result = clip(subject, clipPoly);

        expect(result.length).toBe(1);
        expect(result[0].length).toBe(1);

        expect(result[0][0]).toEqualRing([new Point(3, 2), new Point(5, 2), new Point(5, 3), new Point(3, 3), new Point(3, 2)]);
    });

    test('clip polygon fully inside the subject polygon', () => {
        const clipPoly = [new Point(3, 3), new Point(5, 3), new Point(5, 5), new Point(3, 5), new Point(3, 3)];

        const result = clip(subject, clipPoly);

        expect(result.length).toBe(1);
        expect(result[0].length).toBe(1);

        expect(result[0][0]).toEqualRing(clipPoly);
    });

    test('subject polygon fully inside the clip polygon', () => {
        const clipPoly = [new Point(0, 0), new Point(7, 0), new Point(7, 7), new Point(0, 7), new Point(0, 0)];

        const result = clip(subject, clipPoly);

        expect(result.length).toBe(1);
        expect(result[0].length).toBe(1);

        expect(result[0][0]).toEqualRing(subject[0]);
    });

    test('no intersections', () => {
        const clipPoly = [new Point(7, 0), new Point(8, 0), new Point(8, 8), new Point(7, 8), new Point(7, 0)];

        const result = clip(subject, clipPoly);

        expect(result.length).toBe(0);
    });

    test('clip polygon intersecting single edge of the subject multiple times', () => {
        const clipPoly = [new Point(3, 5), new Point(5, 5), new Point(5, 7), new Point(3, 7), new Point(3, 5)];

        const result = clip(subject, clipPoly);

        expect(result.length).toBe(1);
        expect(result[0].length).toBe(1);

        expect(result[0][0]).toEqualRing([new Point(3, 5), new Point(5, 5), new Point(5, 6), new Point(3, 6), new Point(3, 5)]);
    });
});

describe('polygon clipping, complex polygon clipping', () => {
    // Rectangular polygon with two holes on top of each other
    const exteriorRing = [new Point(20, 20), new Point(60, 20), new Point(60, 100), new Point(20, 100), new Point(20, 20)];
    const topHole = [new Point(30, 30), new Point(30, 50), new Point(50, 50), new Point(50, 30), new Point(30, 30)];
    const bottomHole = [new Point(30, 70), new Point(30, 90), new Point(50, 90), new Point(50, 70), new Point(30, 70)];

    const subject = [exteriorRing, topHole, bottomHole];

    test('subject polygon fully inside the clip polygon', () => {
        const clipPoly = [new Point(10, 10), new Point(70, 10), new Point(150, 110), new Point(-50, 250), new Point(10, 10)];

        const result = clip(subject, clipPoly);

        expect(result.length).toBe(1);
        expect(result[0].length).toBe(3);

        expect(result[0][0]).toEqualRing(exteriorRing);
        expect(result[0][1]).toEqualRing(topHole);
        expect(result[0][2]).toEqualRing(bottomHole);
    });

    test('cut bottom hole', () => {
        const clipPoly = [new Point(10, 60), new Point(70, 60), new Point(70, 110), new Point(10, 110), new Point(10, 60)];

        const result = clip(subject, clipPoly);

        expect(result.length).toBe(1);
        expect(result[0].length).toBe(2);

        expect(result[0][0]).toEqualRing([new Point(20, 60), new Point(60, 60), new Point(60, 100), new Point(20, 100), new Point(20, 60)]);
        expect(result[0][1]).toEqualRing(bottomHole);
    });

    test('cut top hole and half of the bottom', () => {
        const clipPoly = [new Point(0, 0), new Point(80, 0), new Point(80, 80), new Point(0, 80), new Point(0, 0)];

        const result = clip(subject, clipPoly);

        expect(result.length).toBe(1);
        expect(result[0].length).toBe(2);

        expect(result[0][0]).toEqualRing([new Point(20, 20), new Point(60, 20), new Point(60, 80), new Point(50, 80), new Point(50, 70), new Point(30, 70), new Point(30, 80), new Point(20, 80), new Point(20, 20)]);
        expect(result[0][1]).toEqualRing(topHole);
    });

    test('clip polygon inside exterior of the subject polygon, top hole fully inside the clip polygon', () => {
        const clipPoly = [new Point(25, 25), new Point(55, 25), new Point(55, 55), new Point(25, 55), new Point(25, 25)];

        const result = clip(subject, clipPoly);

        expect(result.length).toBe(1);
        expect(result[0].length).toBe(2);

        expect(result[0][0]).toEqualRing(clipPoly);
        expect(result[0][1]).toEqualRing(topHole);
    });

    test('clip polygon fully inside one of the holes', () => {
        const clipPoly = [new Point(35, 75), new Point(45, 75), new Point(45, 85), new Point(35, 85), new Point(35, 75)];

        const result = clip(subject, clipPoly);

        expect(result.length).toBe(0);
    });

    test('clip polygon inside exterior of the subject polygon, intersecting with bottom hole', () => {
        const clipPoly = [new Point(25, 60), new Point(55, 60), new Point(55, 80), new Point(25, 80), new Point(25, 60)];

        const result = clip(subject, clipPoly);

        expect(result.length).toBe(1);
        expect(result[0].length).toBe(1);

        expect(result[0][0]).toEqualRing([new Point(25, 60), new Point(55, 60), new Point(55, 80), new Point(50, 80), new Point(50, 70), new Point(30, 70), new Point(30, 80), new Point(25, 80), new Point(25, 60)]);
    });
});

describe('polygon clipping, multiple output', () => {
    test('concave clip polygon splits subject polygon into two parts', () => {
        const subject = [new Point(-20, 10), new Point(20, 10), new Point(20, 30), new Point(-20, 30), new Point(-20, 10)];
        const clipPoly = [new Point(-40, -10), new Point(40, -10), new Point(40, 40), new Point(0, 0), new Point(-40, 40), new Point(-40, -10)];

        const result = clip([subject], clipPoly);

        expect(result.length).toBe(2);
        expect(result[0].length).toBe(1);
        expect(result[1].length).toBe(1);

        expect(result[0][0]).toEqualRing([new Point(-20, 10), new Point(-10, 10), new Point(-20, 20), new Point(-20, 10)]);
        expect(result[1][0]).toEqualRing([new Point(10, 10), new Point(20, 10), new Point(20, 20), new Point(10, 10)]);
    });

    test('concave clip polygon, complex subject polygon', () => {
        const exteriorRing = [new Point(20, 20), new Point(60, 20), new Point(60, 100), new Point(20, 100), new Point(20, 20)];
        const topHole = [new Point(30, 30), new Point(30, 50), new Point(50, 50), new Point(50, 30), new Point(30, 30)];
        const bottomHole = [new Point(30, 70), new Point(30, 90), new Point(50, 90), new Point(50, 70), new Point(30, 70)];

        const subject = [exteriorRing, topHole, bottomHole];
        const clipPoly = [new Point(15, 35), new Point(80, 35), new Point(80, 95), new Point(10, 95), new Point(10, 60), new Point(70, 60), new Point(70, 45), new Point(15, 45), new Point(15, 35)];

        const result = clip(subject, clipPoly);

        expect(result.length).toBe(3);
        expect(result[0].length).toBe(1);
        expect(result[1].length).toBe(2);
        expect(result[2].length).toBe(1);

        expect(result[0][0]).toEqualRing([new Point(20, 35), new Point(30, 35), new Point(30, 45), new Point(20, 45), new Point(20, 35)]);
        expect(result[1][0]).toEqualRing([new Point(20, 60), new Point(60, 60), new Point(60, 95), new Point(20, 95), new Point(20, 60)]);
        expect(result[1][1]).toEqualRing(bottomHole);
        expect(result[2][0]).toEqualRing([new Point(50, 35), new Point(60, 35), new Point(60, 45), new Point(50, 45), new Point(50, 35)]);
    });
});

describe('polygon subdivision', () => {
    test('simple polygon', () => {
        const subject = [new Point(0, 0), new Point(100, 0), new Point(100, 20), new Point(0, 20), new Point(0, 0)];

        const edges = new MockEdgeIterator([
            [new Point(25, 0), new Point(25, 20)],
            [new Point(30, -10), new Point(70, 30)],
            [new Point(75, -20), new Point(75, 40)]
        ]);

        const result = polygonSubdivision(convertToCollection(subject), edges);

        expect(result.length).toBe(4);
        expect(result[0].length).toBe(1);
        expect(result[1].length).toBe(1);
        expect(result[2].length).toBe(1);
        expect(result[3].length).toBe(1);

        expect(result[0][0]).toEqualRing([new Point(0, 0), new Point(25, 0), new Point(25, 20), new Point(0, 20), new Point(0, 0)]);
        expect(result[1][0]).toEqualRing([new Point(25, 0), new Point(40, 0), new Point(60, 20), new Point(25, 20), new Point(25, 0)]);
        expect(result[2][0]).toEqualRing([new Point(40, 0), new Point(75, 0), new Point(75, 20), new Point(60, 20), new Point(40, 0)]);
        expect(result[3][0]).toEqualRing([new Point(75, 0), new Point(100, 0), new Point(100, 20), new Point(75, 20), new Point(75, 0)]);
    });

    test('complex polygon', () => {
        const exteriorRing = [new Point(10, 10), new Point(80, 10), new Point(80, 50), new Point(10, 50), new Point(10, 10)];
        const hole = [new Point(30, 20), new Point(30, 40), new Point(50, 40), new Point(50, 20), new Point(30, 20)];
        const subject = [exteriorRing, hole];

        const edges = new MockEdgeIterator([
            [new Point(70, 60), new Point(70, 0)],
            [new Point(40, 60), new Point(40, 0)]
        ]);

        const result = polygonSubdivision(subject, edges);

        expect(result.length).toBe(3);
        expect(result[0].length).toBe(1);
        expect(result[1].length).toBe(1);
        expect(result[2].length).toBe(1);

        expect(result[0][0]).toEqualRing([new Point(10, 10), new Point(40, 10), new Point(40, 20), new Point(30, 20), new Point(30, 40), new Point(40, 40), new Point(40, 50), new Point(10, 50), new Point(10, 10)]);
        expect(result[1][0]).toEqualRing([new Point(40, 10), new Point(70, 10), new Point(70, 50), new Point(40, 50), new Point(40, 40), new Point(50, 40), new Point(50, 20), new Point(40, 20), new Point(40, 10)]);
        expect(result[2][0]).toEqualRing([new Point(70, 10), new Point(80, 10), new Point(80, 50), new Point(70, 50), new Point(70, 10)]);
    });

    test('polygon with holes after clipping', () => {
        const exteriorRing = [new Point(10, 10), new Point(20, 10), new Point(20, 20), new Point(10, 20), new Point(10, 10)];
        const hole = [new Point(12, 12), new Point(12, 16), new Point(16, 16), new Point(16, 12), new Point(12, 12)];
        const hole2 = [new Point(11, 17), new Point(16, 19), new Point(16, 17), new Point(11, 17)];
        const subject = [exteriorRing, hole, hole2];

        const edges = new MockEdgeIterator([
            [new Point(17, 30), new Point(17, 0)]
        ]);

        const result = polygonSubdivision(subject, edges);

        expect(result.length).toBe(2);
        expect(result[0].length).toBe(3);
        expect(result[1].length).toBe(1);

        expect(result[0][0]).toEqualRing([new Point(10, 10), new Point(17, 10), new Point(17, 20), new Point(10, 20), new Point(10, 10)]);
        expect(result[0][1]).toEqualRing(hole2);
        expect(result[0][2]).toEqualRing(hole);
        expect(result[1][0]).toEqualRing([new Point(17, 10), new Point(20, 10), new Point(20, 20), new Point(17, 20), new Point(17, 10)]);
    });

    test('clip through point', () => {
        const exteriorRing = [new Point(10, 10), new Point(20, 10), new Point(30, 10), new Point(40, 10), new Point(25, 20), new Point(10, 10)];
        const subject = [exteriorRing];

        const edges = new MockEdgeIterator([
            [new Point(25, 0), new Point(25, 25)]
        ]);

        const result = polygonSubdivision(subject, edges);

        expect(result.length).toBe(2);
        expect(result[0].length).toBe(1);
        expect(result[1].length).toBe(1);

        expect(result[0][0]).toEqualRing([new Point(10, 10), new Point(20, 10), new Point(25, 10), new Point(25, 20), new Point(10, 10)]);
        expect(result[1][0]).toEqualRing([new Point(25, 10), new Point(30, 10), new Point(40, 10), new Point(25, 20), new Point(25, 10)]);
    });

    test('polygon with a branch', () => {
        const exteriorRing = [new Point(40, 30), new Point(100, 20), new Point(100, 30), new Point(70, 40), new Point(100, 50), new Point(100, 60), new Point(40, 50), new Point(40, 30)];
        const hole = [new Point(45, 35), new Point(45, 45), new Point(65, 45), new Point(65, 35), new Point(45, 35)];
        const subject = [exteriorRing, hole];

        const edges = new MockEdgeIterator([
            [new Point(20, 0), new Point(20, 80)],
            [new Point(30, 0), new Point(30, 80)],
            [new Point(50, 0), new Point(50, 80)],
            [new Point(60, 0), new Point(60, 80)],
            [new Point(80, 0), new Point(80, 80)],
            [new Point(90, 0), new Point(90, 80)],
            [new Point(110, 0), new Point(110, 80)]
        ]);

        const result = polygonSubdivision(subject, edges);

        expect(result.length).toBe(8);
        expect(result[0].length).toBe(1);
        expect(result[1].length).toBe(1);
        expect(result[2].length).toBe(1);
        expect(result[3].length).toBe(1);
        expect(result[4].length).toBe(1);
        expect(result[5].length).toBe(1);
        expect(result[6].length).toBe(1);
        expect(result[7].length).toBe(1);

        expect(result[0][0]).toEqualRing([new Point(40, 30), new Point(50, 28),  new Point(50, 35), new Point(45, 35), new Point(45, 45), new Point(50, 45), new Point(50, 52), new Point(40, 50), new Point(40, 30)]);
        expect(result[1][0]).toEqualRing([new Point(50, 28), new Point(60, 27), new Point(60, 35), new Point(50, 35), new Point(50, 28)]);
        expect(result[2][0]).toEqualRing([new Point(50, 45), new Point(60, 45), new Point(60, 53), new Point(50, 52), new Point(50, 45)]);
        expect(result[3][0]).toEqualRing([new Point(60, 27), new Point(80, 23), new Point(80, 37), new Point(70, 40), new Point(80, 43), new Point(80, 57), new Point(60, 53), new Point(60, 45), new Point(65, 45), new Point(65, 35), new Point(60, 35), new Point(60, 27)]);
        expect(result[4][0]).toEqualRing([new Point(80, 23), new Point(90, 22), new Point(90, 33), new Point(80, 37), new Point(80, 23)]);
        expect(result[5][0]).toEqualRing([new Point(80, 43), new Point(90, 47), new Point(90, 58), new Point(80, 57), new Point(80, 43)]);
        expect(result[6][0]).toEqualRing([new Point(90, 22), new Point(100, 20), new Point(100, 30), new Point(90, 33), new Point(90, 22)]);
        expect(result[7][0]).toEqualRing([new Point(90, 47), new Point(100, 50), new Point(100, 60), new Point(90, 58), new Point(90, 47)]);
    });
});
