import {describe, test, expect} from "../../util/vitest.js";
import Point from '@mapbox/point-geometry';
import PathInterpolator from '../../../src/symbol/path_interpolator.js';

describe('PathInterpolator', () => {
    const pointEquals = (p0, p1) => {
        const e = 0.000001;
        return Math.abs(p0.x - p1.x) < e && Math.abs(p0.y - p1.y) < e;
    };

    test('Interpolate single segment path', () => {
        const line = [
            new Point(0, 0),
            new Point(10, 0)
        ];

        const interpolator = new PathInterpolator(line);

        expect(interpolator.lerp(0.0)).toEqual(line[0]);
        expect(interpolator.lerp(0.5)).toEqual(new Point(5, 0));
        expect(interpolator.lerp(1.0)).toEqual(line[1]);
    });

    test('t < 0', () => {
        const line = [
            new Point(0, 0),
            new Point(10, 0)
        ];

        const interpolator = new PathInterpolator(line);
        expect(interpolator.lerp(-100.0)).toEqual(line[0]);
    });

    test('t > 0', () => {
        const line = [
            new Point(0, 0),
            new Point(10, 0)
        ];

        const interpolator = new PathInterpolator(line);
        expect(interpolator.lerp(100.0)).toEqual(line[1]);
    });

    test('Interpolate multi-segment path', () => {
        const line = [
            new Point(-3, 3),
            new Point(-1, 3),
            new Point(-1, -2),
            new Point(2, -2),
            new Point(2, 1),
            new Point(-3, 1)
        ];

        const interpolator = new PathInterpolator(line);
        expect(pointEquals(interpolator.lerp(1.0), new Point(-3, 1))).toBeTruthy();
        expect(pointEquals(interpolator.lerp(0.95), new Point(-2.1, 1))).toBeTruthy();
        expect(pointEquals(interpolator.lerp(0.5), new Point(1, -2))).toBeTruthy();
        expect(pointEquals(interpolator.lerp(0.25), new Point(-1, 0.5))).toBeTruthy();
        expect(pointEquals(interpolator.lerp(0.1), new Point(-1.2, 3))).toBeTruthy();
        expect(pointEquals(interpolator.lerp(0.0), new Point(-3, 3))).toBeTruthy();
    });

    test('Small padding', () => {
        const line = [
            new Point(-4, 1),
            new Point(4, 1)
        ];

        const padding = 0.5;
        const interpolator = new PathInterpolator(line, padding);

        expect(pointEquals(interpolator.lerp(0.0), new Point(-3.5, 1))).toBeTruthy();
        expect(pointEquals(interpolator.lerp(0.25), new Point(-1.75, 1))).toBeTruthy();
        expect(pointEquals(interpolator.lerp(0.5), new Point(0, 1))).toBeTruthy();
        expect(pointEquals(interpolator.lerp(1.0), new Point(3.5, 1))).toBeTruthy();
    });

    test('Padding cannot be larger than the length / 2', () => {
        const line = [
            new Point(-3, 0),
            new Point(3, 0)
        ];

        const padding = 10.0;
        const interpolator = new PathInterpolator(line, padding);

        expect(pointEquals(interpolator.lerp(0.0), new Point(0, 0))).toBeTruthy();
        expect(pointEquals(interpolator.lerp(0.4), new Point(0, 0))).toBeTruthy();
        expect(pointEquals(interpolator.lerp(1.0), new Point(0, 0))).toBeTruthy();
    });

    test('Single point path', () => {
        const interpolator = new PathInterpolator([new Point(0, 0)]);
        expect(pointEquals(interpolator.lerp(0), new Point(0, 0))).toBeTruthy();
        expect(pointEquals(interpolator.lerp(1.0), new Point(0, 0))).toBeTruthy();
    });

    test('Interpolator instance can be reused by calling reset()', () => {
        const line0 = [
            new Point(0, 0),
            new Point(10, 0)
        ];

        const line1 = [
            new Point(-10, 10),
            new Point(10, -10)
        ];

        const interpolator = new PathInterpolator(line0);

        expect(interpolator.lerp(0.0)).toEqual(line0[0]);
        expect(interpolator.lerp(0.5)).toEqual(new Point(5, 0));
        expect(interpolator.lerp(1.0)).toEqual(line0[1]);

        interpolator.reset(line1);
        expect(pointEquals(interpolator.lerp(0.0), line1[0])).toBeTruthy();
        expect(pointEquals(interpolator.lerp(0.5), new Point(0, 0))).toBeTruthy();
        expect(pointEquals(interpolator.lerp(1.0), line1[1])).toBeTruthy();
    });

    test('Path with zero length segment', () => {
        const line = [
            new Point(-1, 0),
            new Point(1, 0),
            new Point(1, 0)
        ];

        const interpolator = new PathInterpolator(line);
        expect(pointEquals(interpolator.lerp(0), line[0])).toBeTruthy();
        expect(pointEquals(interpolator.lerp(0.5), new Point(0, 0))).toBeTruthy();
        expect(pointEquals(interpolator.lerp(1), line[1])).toBeTruthy();
        expect(pointEquals(interpolator.lerp(1), line[2])).toBeTruthy();
    });
});
