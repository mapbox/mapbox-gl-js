import {describe, test, expect} from "../../util/vitest.js";
import {triangleIntersectsTriangle} from '../../../src/util/intersection_tests.js';
import Point from '@mapbox/point-geometry';

describe('Intersection tests', () => {
    const newTriangle = (p0, p1, p2) => {
        return [
            new Point(...p0),
            new Point(...p1),
            new Point(...p2)
        ];
    };

    test('triangleIntersectsTriangle', () => {
        let t0 = newTriangle([0, 0], [2, 2], [0, 2]);
        let t1 = newTriangle([1, 0], [3, 0], [3, 2]);

        expect(triangleIntersectsTriangle(...t0, ...t1)).toBeFalsy();

        t0 = newTriangle([-120, 20], [-118, 20], [-119, 22]);
        t1 = newTriangle([-118, 21], [-119, 23], [-120, 21]);

        expect(triangleIntersectsTriangle(...t0, ...t1)).toBeTruthy();

        t0 = newTriangle([1.24, 4.2], [7.0, 1.9], [4.753, 8.01]);
        t1 = newTriangle([5.89, 1.0], [7.5, 0.7], [8.0, 4.0]);

        expect(triangleIntersectsTriangle(...t0, ...t1)).toBeTruthy();

        t0 = newTriangle([1.24, 4.2], [7.0, 1.9], [4.753, 8.01]);
        t1 = newTriangle([6.89, 1.0], [8.5, 0.7], [9.0, 4.0]);

        expect(triangleIntersectsTriangle(...t0, ...t1)).toBeFalsy();
    });
});
