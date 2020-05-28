import {test} from '../../util/test';
import Point from '@mapbox/point-geometry';
import PathInterpolator from '../../../src/symbol/path_interpolator';

test('PathInterpolator', (t) => {

    const pointEquals = (p0, p1) => {
        const e = 0.000001;
        return Math.abs(p0.x - p1.x) < e && Math.abs(p0.y - p1.y) < e;
    };

    t.test('Interpolate single segment path', (t) => {
        const line = [
            new Point(0, 0),
            new Point(10, 0)
        ];

        const interpolator = new PathInterpolator(line);

        t.deepEqual(interpolator.lerp(0.0), line[0]);
        t.deepEqual(interpolator.lerp(0.5), new Point(5, 0));
        t.deepEqual(interpolator.lerp(1.0), line[1]);
        t.end();
    });

    t.test('t < 0', (t) => {
        const line = [
            new Point(0, 0),
            new Point(10, 0)
        ];

        const interpolator = new PathInterpolator(line);
        t.deepEqual(interpolator.lerp(-100.0), line[0]);
        t.end();
    });

    t.test('t > 0', (t) => {
        const line = [
            new Point(0, 0),
            new Point(10, 0)
        ];

        const interpolator = new PathInterpolator(line);
        t.deepEqual(interpolator.lerp(100.0), line[1]);
        t.end();
    });

    t.test('Interpolate multi-segment path', (t) => {
        const line = [
            new Point(-3, 3),
            new Point(-1, 3),
            new Point(-1, -2),
            new Point(2, -2),
            new Point(2, 1),
            new Point(-3, 1)
        ];

        const interpolator = new PathInterpolator(line);
        t.ok(pointEquals(interpolator.lerp(1.0), new Point(-3, 1)));
        t.ok(pointEquals(interpolator.lerp(0.95), new Point(-2.1, 1)));
        t.ok(pointEquals(interpolator.lerp(0.5), new Point(1, -2)));
        t.ok(pointEquals(interpolator.lerp(0.25), new Point(-1, 0.5)));
        t.ok(pointEquals(interpolator.lerp(0.1), new Point(-1.2, 3)));
        t.ok(pointEquals(interpolator.lerp(0.0), new Point(-3, 3)));
        t.end();
    });

    t.test('Small padding', (t) => {
        const line = [
            new Point(-4, 1),
            new Point(4, 1)
        ];

        const padding = 0.5;
        const interpolator = new PathInterpolator(line, padding);

        t.ok(pointEquals(interpolator.lerp(0.0), new Point(-3.5, 1)));
        t.ok(pointEquals(interpolator.lerp(0.25), new Point(-1.75, 1)));
        t.ok(pointEquals(interpolator.lerp(0.5), new Point(0, 1)));
        t.ok(pointEquals(interpolator.lerp(1.0), new Point(3.5, 1)));
        t.end();
    });

    t.test('Padding cannot be larger than the length / 2', (t) => {
        const line = [
            new Point(-3, 0),
            new Point(3, 0)
        ];

        const padding = 10.0;
        const interpolator = new PathInterpolator(line, padding);

        t.ok(pointEquals(interpolator.lerp(0.0), new Point(0, 0)));
        t.ok(pointEquals(interpolator.lerp(0.4), new Point(0, 0)));
        t.ok(pointEquals(interpolator.lerp(1.0), new Point(0, 0)));
        t.end();
    });

    t.test('Single point path', (t) => {
        const interpolator = new PathInterpolator([new Point(0, 0)]);
        t.ok(pointEquals(interpolator.lerp(0), new Point(0, 0)));
        t.ok(pointEquals(interpolator.lerp(1.0), new Point(0, 0)));
        t.end();
    });

    t.test('Interpolator instance can be reused by calling reset()', (t) => {
        const line0 = [
            new Point(0, 0),
            new Point(10, 0)
        ];

        const line1 = [
            new Point(-10, 10),
            new Point(10, -10)
        ];

        const interpolator = new PathInterpolator(line0);

        t.deepEqual(interpolator.lerp(0.0), line0[0]);
        t.deepEqual(interpolator.lerp(0.5), new Point(5, 0));
        t.deepEqual(interpolator.lerp(1.0), line0[1]);

        interpolator.reset(line1);
        t.ok(pointEquals(interpolator.lerp(0.0), line1[0]));
        t.ok(pointEquals(interpolator.lerp(0.5), new Point(0, 0)));
        t.ok(pointEquals(interpolator.lerp(1.0), line1[1]));
        t.end();
    });

    t.test('Path with zero length segment', (t) => {
        const line = [
            new Point(-1, 0),
            new Point(1, 0),
            new Point(1, 0)
        ];

        const interpolator = new PathInterpolator(line);
        t.ok(pointEquals(interpolator.lerp(0), line[0]));
        t.ok(pointEquals(interpolator.lerp(0.5), new Point(0, 0)));
        t.ok(pointEquals(interpolator.lerp(1), line[1]));
        t.ok(pointEquals(interpolator.lerp(1), line[2]));
        t.end();
    });

    t.end();
});
