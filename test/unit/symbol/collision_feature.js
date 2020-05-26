import {test} from '../../util/test';
import CollisionFeature from '../../../src/symbol/collision_feature';
import Anchor from '../../../src/symbol/anchor';
import Point from '@mapbox/point-geometry';
import {CollisionBoxArray} from '../../../src/data/array_types';

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
        const anchor = new Anchor(point.x, point.y, 0, undefined);

        const cf = new CollisionFeature(collisionBoxArray, anchor, 0, 0, 0, shapedText, 1, 0, false);
        t.notOk(cf.circleDiameter);
        t.equal(cf.boxEndIndex - cf.boxStartIndex, 1);

        const box = collisionBoxArray.get(cf.boxStartIndex);
        t.equal(box.x1, -50);
        t.equal(box.x2, 50);
        t.equal(box.y1, -10);
        t.equal(box.y2, 10);
        t.end();
    });

    test('Compute line height for runtime collision circles (line label)', (t) => {
        const anchor = new Anchor(505, 95, 0, 1);
        const cf = new CollisionFeature(collisionBoxArray, anchor, 0, 0, 0, shapedText, 1, 0, true);
        t.ok(cf.circleDiameter);
        t.equal(cf.circleDiameter, shapedText.bottom - shapedText.top);
        t.equal(cf.boxEndIndex - cf.boxStartIndex, 0);
        t.end();
    });

    test('Collision circle diameter is not computed for features with zero height', (t) => {
        const shapedText = {
            left: -50,
            top: -10,
            right: 50,
            bottom: -10
        };

        const anchor = new Anchor(505, 95, 0, 1);
        const cf = new CollisionFeature(collisionBoxArray, anchor, 0, 0, 0, shapedText, 1, 0, true);
        t.equal(cf.boxEndIndex - cf.boxStartIndex, 0);
        t.notOk(cf.circleDiameter);
        t.end();
    });

    test('Collision circle diameter is not computed for features with negative height', (t) => {
        const shapedText = {
            left: -50,
            top: 10,
            right: 50,
            bottom: -10
        };

        const anchor = new Anchor(505, 95, 0, 1);
        const cf = new CollisionFeature(collisionBoxArray, anchor, 0, 0, 0, shapedText, 1, 0, true);
        t.equal(cf.boxEndIndex - cf.boxStartIndex, 0);
        t.notOk(cf.circleDiameter);
        t.end();
    });

    test('Use minimum collision circle diameter', (t) => {
        const shapedText = {
            left: -50,
            top: 10,
            right: 50,
            bottom: 10.00001
        };

        const anchor = new Anchor(505, 95, 0, 1);
        const cf = new CollisionFeature(collisionBoxArray, anchor, 0, 0, 0, shapedText, 1, 0, true);
        t.equal(cf.boxEndIndex - cf.boxStartIndex, 0);
        t.equal(cf.circleDiameter, 10);
        t.end();
    });

    t.end();
});
