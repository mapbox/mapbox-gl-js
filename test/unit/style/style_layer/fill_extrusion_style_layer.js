import {test} from '../../../util/test';
import {getIntersectionDistance} from '../../../../src/style/style_layer/fill_extrusion_style_layer';
import Point from '@mapbox/point-geometry';

test('getIntersectionDistance', (t) => {
    const queryPoint = [new Point(100, 100)];
    const z = 3;
    const a = new Point(100, -90);
    const b = new Point(110, 110);
    const c = new Point(-110, 110);
    a.z = z;
    b.z = z;
    c.z = z;

    t.test('one point', (t) => {
        const projectedFace = [a, a];
        t.equal(getIntersectionDistance(queryPoint, projectedFace), Infinity);
        t.end();
    });

    t.test('two points', (t) => {
        const projectedFace = [a, b, a];
        t.equal(getIntersectionDistance(queryPoint, projectedFace), Infinity);
        t.end();
    });

    t.test('two points coincident', (t) => {
        const projectedFace = [a, a, a, b, b, b, b, a];
        t.equal(getIntersectionDistance(queryPoint, projectedFace), Infinity);
        t.end();
    });

    t.test('three points', (t) => {
        const projectedFace = [a, b, c, a];
        t.equal(getIntersectionDistance(queryPoint, projectedFace), z);
        t.end();
    });

    t.test('three points coincident points', (t) => {
        const projectedFace = [a, a, b, b, b, c, c, a];
        t.equal(getIntersectionDistance(queryPoint, projectedFace), z);
        t.end();
    });
    t.end();
});
