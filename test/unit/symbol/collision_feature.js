import {test} from '../../util/test.js';
import Anchor from '../../../src/symbol/anchor.js';
import {evaluateCircleCollisionFeature, evaluateBoxCollisionFeature} from '../../../src/symbol/symbol_layout.js';
import Point from '@mapbox/point-geometry';
import {CollisionBoxArray} from '../../../src/data/array_types.js';

test('CollisionFeature', (t) => {

    const collisionBoxArray = new CollisionBoxArray();

    const shapedText = {
        left: -50,
        top: -10,
        right: 50,
        bottom: 10
    };

    test('point label', (t) => {
        const point = new Point(500, 0);
        const anchor = new Anchor(point.x, point.y, 0, 0, undefined);

        const index = evaluateBoxCollisionFeature(collisionBoxArray, anchor, anchor, 0, 0, 0, shapedText, 1, 0);
        t.equal(index, 0);

        const box = collisionBoxArray.get(index);
        t.equal(box.x1, -50);
        t.equal(box.x2, 50);
        t.equal(box.y1, -10);
        t.equal(box.y2, 10);
        t.end();
    });

    test('Compute line height for runtime collision circles (line label)', (t) => {
        const diameter = evaluateCircleCollisionFeature(shapedText);
        t.equal(diameter, shapedText.bottom - shapedText.top);
        t.end();
    });

    test('Collision circle diameter is not computed for features with zero height', (t) => {
        const shapedText = {
            left: -50,
            top: -10,
            right: 50,
            bottom: -10
        };

        const diameter = evaluateCircleCollisionFeature(shapedText);
        t.notOk(diameter);
        t.end();
    });

    test('Collision circle diameter is not computed for features with negative height', (t) => {
        const shapedText = {
            left: -50,
            top: 10,
            right: 50,
            bottom: -10
        };

        const diameter = evaluateCircleCollisionFeature(shapedText);
        t.notOk(diameter);
        t.end();
    });

    test('Use minimum collision circle diameter', (t) => {
        const shapedText = {
            left: -50,
            top: 10,
            right: 50,
            bottom: 10.00001
        };

        const diameter = evaluateCircleCollisionFeature(shapedText);
        t.equal(diameter, 10);
        t.end();
    });

    t.end();
});
