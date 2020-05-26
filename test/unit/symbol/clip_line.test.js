import {test} from '../../util/test';
import Point from '@mapbox/point-geometry';
import clipLine from '../../../src/symbol/clip_line';

test('clipLines', (t) => {

    const minX = -300;
    const maxX = 300;
    const minY = -200;
    const maxY = 200;

    const clipLineTest = (lines) => {
        return clipLine(lines, minX, minY, maxX, maxY);
    };

    t.test('Single line fully inside', (t) => {
        const line = [
            new Point(-100, -100),
            new Point(-40, -100),
            new Point(200, 0),
            new Point(-80, 195)
        ];

        t.deepEqual(clipLineTest([line]), [line]);
        t.end();
    });

    t.test('Multiline fully inside', (t) => {
        const line0 = [
            new Point(-250, -150),
            new Point(-250, 150),
            new Point(-10, 150),
            new Point(-10, -150)
        ];

        const line1 = [
            new Point(250, -150),
            new Point(250, 150),
            new Point(10, 150),
            new Point(10, -150)
        ];

        const lines = [line0, line1];

        t.deepEqual(clipLineTest(lines), lines);
        t.end();
    });

    t.test('Lines fully outside', (t) => {
        const line0 = [
            new Point(-400, -300),
            new Point(-350, 0),
            new Point(-300, 300)
        ];

        const line1 = [
            new Point(1000, 210),
            new Point(10000, 500)
        ];

        t.deepEqual(clipLineTest([line0, line1]), []);
        t.end();
    });

    t.test('Intersect with single border', (t) => {
        const line0 = [
            new Point(-400, 0),
            new Point(0, 0)
        ];

        const result0 = [
            new Point(minX, 0),
            new Point(0, 0)
        ];

        const line1 = [
            new Point(250, -50),
            new Point(350, 50)
        ];

        const result1 = [
            new Point(250, -50),
            new Point(maxX, 0)
        ];

        t.deepEqual(clipLineTest([line0, line1]), [result0, result1]);
        t.end();
    });

    t.test('Intersect with multiple borders', (t) => {
        const line0 = [
            new Point(-350, -100),
            new Point(-200, -250)
        ];

        const line1 = [
            new Point(-100, 250),
            new Point(0, 150),
            new Point(100, 250)
        ];

        const result0 = [
            new Point(minX, -150),
            new Point(-250, minY)
        ];

        const result1 = [
            new Point(-50, maxY),
            new Point(0, 150),
            new Point(50, maxY)
        ];

        t.deepEqual(clipLineTest([line0, line1]), [result0, result1]);
        t.end();
    });

    t.test('Single line can be split into multiple segments', (t) => {
        const line = [
            new Point(-80, 150),
            new Point(-80, 350),
            new Point(120, 1000),
            new Point(120, 0)
        ];

        const result0 = [
            new Point(-80, 150),
            new Point(-80, maxY),
        ];

        const result1 = [
            new Point(120, maxY),
            new Point(120, 0),
        ];

        t.deepEqual(clipLineTest([line]), [result0, result1]);
        t.end();
    });

    t.test('Non-clipped points are bit exact', (t) => {
        const line = [
            new Point(-500, -200),
            new Point(131.2356763, 0.956732)
        ];

        t.deepEqual(clipLineTest([line])[1], line[0][1]);
        t.end();
    });

    t.test('Clipped points are rounded to the nearest integer', (t) => {
        const line = [
            new Point(310, 2.9),
            new Point(290, 2.5)
        ];

        const result = [
            new Point(maxX, 3),
            new Point(290, 2.5)
        ];

        t.deepEqual(clipLineTest([line]), [result]);
        t.end();
    });

    t.end();
});
