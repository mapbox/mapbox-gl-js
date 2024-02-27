import {describe, test, expect} from "../../../util/vitest.js";
import {getIntersectionDistance} from '../../../../src/style/style_layer/fill_extrusion_style_layer.js';
import Point from '@mapbox/point-geometry';

describe('getIntersectionDistance', () => {
    const queryPoint = [new Point(100, 100)];
    const z = 3;
    const a = new Point(100, -90);
    const b = new Point(110, 110);
    const c = new Point(-110, 110);
    a.z = z;
    b.z = z;
    c.z = z;

    test('one point', () => {
        const projectedFace = [a, a];
        expect(getIntersectionDistance(queryPoint, projectedFace)).toEqual(Infinity);
    });

    test('two points', () => {
        const projectedFace = [a, b, a];
        expect(getIntersectionDistance(queryPoint, projectedFace)).toEqual(Infinity);
    });

    test('two points coincident', () => {
        const projectedFace = [a, a, a, b, b, b, b, a];
        expect(getIntersectionDistance(queryPoint, projectedFace)).toEqual(Infinity);
    });

    test('three points', () => {
        const projectedFace = [a, b, c, a];
        expect(getIntersectionDistance(queryPoint, projectedFace)).toEqual(z);
    });

    test('three points coincident points', () => {
        const projectedFace = [a, a, b, b, b, c, c, a];
        expect(getIntersectionDistance(queryPoint, projectedFace)).toEqual(z);
    });
});
