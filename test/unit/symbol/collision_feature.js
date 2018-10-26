import { test } from 'mapbox-gl-js-test';
import CollisionFeature from '../../../src/symbol/collision_feature';
import Anchor from '../../../src/symbol/anchor';
import Point from '@mapbox/point-geometry';
import { CollisionBoxArray } from '../../../src/data/array_types';

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

        const cf = new CollisionFeature(collisionBoxArray, [point], anchor, 0, 0, 0, shapedText, 1, 0, false, 1);
        t.equal(cf.boxEndIndex - cf.boxStartIndex, 1);

        const box = collisionBoxArray.get(cf.boxStartIndex);
        t.equal(box.x1, -50);
        t.equal(box.x2, 50);
        t.equal(box.y1, -10);
        t.equal(box.y2, 10);
        t.end();
    });

    test('line label', (t) => {
        const line = [new Point(0, 0), new Point(500, 100), new Point(510, 90), new Point(700, 0)];
        const anchor = new Anchor(505, 95, 0, 1);
        const cf = new CollisionFeature(collisionBoxArray, line, anchor, 0, 0, 0, shapedText, 1, 0, true, 1);
        const boxPoints = pluckAnchorPoints(cf);
        t.deepEqual(boxPoints, [
            { x: 370, y: 74},
            { x: 389, y: 78},
            { x: 409, y: 82},
            { x: 428, y: 86},
            { x: 448, y: 90},
            { x: 468, y: 94},
            { x: 478, y: 96},
            { x: 487, y: 97},
            { x: 497, y: 99},
            { x: 505, y: 95},
            { x: 513, y: 89},
            { x: 522, y: 84},
            { x: 531, y: 80},
            { x: 540, y: 76},
            { x: 549, y: 72},
            { x: 558, y: 67},
            { x: 576, y: 59},
            { x: 594, y: 50},
            { x: 612, y: 42},
            { x: 630, y: 33} ]);
        t.end();
    });

    test('boxes for handling pitch underzooming', (t) => {
        const line = [new Point(0, 0), new Point(500, 100), new Point(510, 90), new Point(700, 0)];
        const anchor = new Anchor(505, 95, 0, 1);
        const cf = new CollisionFeature(collisionBoxArray, line, anchor, 0, 0, 0, shapedText, 1, 0, true, 1);
        const distancesToAnchor = pluckDistancesToAnchor(cf);
        t.deepEqual(distancesToAnchor, [
            -112,
            -96,
            -80,
            -64,
            -48,
            -32,
            -24,
            -16,
            -8,
            0,
            8,
            16,
            24,
            32,
            40,
            48,
            64,
            80,
            96,
            112]);
        t.end();
    });

    test('vertical line label', (t) => {
        const line = [new Point(0, 0), new Point(0, 100), new Point(0, 111), new Point(0, 112), new Point(0, 200)];
        const anchor = new Anchor(0, 110, 0, 1);
        const cf = new CollisionFeature(collisionBoxArray, line, anchor, 0, 0, 0, shapedText, 1, 0, true, 1);
        const boxPoints = pluckAnchorPoints(cf);
        t.deepEqual(boxPoints, [
            { x: 0, y: 10 },
            { x: 0, y: 30 },
            { x: 0, y: 50 },
            { x: 0, y: 70 },
            { x: 0, y: 80 },
            { x: 0, y: 90 },
            { x: 0, y: 100 },
            { x: 0, y: 110 },
            { x: 0, y: 120 },
            { x: 0, y: 130 },
            { x: 0, y: 140 },
            { x: 0, y: 150 },
            { x: 0, y: 160 },
            { x: 0, y: 170 },
            { x: 0, y: 190 } ]);
        t.end();
    });

    test('doesnt create any boxes for features with zero height', (t) => {
        const shapedText = {
            left: -50,
            top: -10,
            right: 50,
            bottom: -10
        };

        const line = [new Point(0, 0), new Point(500, 100), new Point(510, 90), new Point(700, 0)];
        const anchor = new Anchor(505, 95, 0, 1);
        const cf = new CollisionFeature(collisionBoxArray, line, anchor, 0, 0, 0, shapedText, 1, 0, true, 1);
        t.equal(cf.boxEndIndex - cf.boxStartIndex, 0);
        t.end();
    });

    test('doesnt create any boxes for features with negative height', (t) => {
        const shapedText = {
            left: -50,
            top: 10,
            right: 50,
            bottom: -10
        };

        const line = [new Point(0, 0), new Point(500, 100), new Point(510, 90), new Point(700, 0)];
        const anchor = new Anchor(505, 95, 0, 1);
        const cf = new CollisionFeature(collisionBoxArray, line, anchor, 0, 0, 0, shapedText, 1, 0, true, 1);
        t.equal(cf.boxEndIndex - cf.boxStartIndex, 0);
        t.end();
    });

    test('doesnt create way too many tiny boxes for features with really low height', (t) => {
        const shapedText = {
            left: -50,
            top: 10,
            right: 50,
            bottom: 10.00001
        };

        const line = [new Point(0, 0), new Point(500, 100), new Point(510, 90), new Point(700, 0)];
        const anchor = new Anchor(505, 95, 0, 1);
        const cf = new CollisionFeature(collisionBoxArray, line, anchor, 0, 0, 0, shapedText, 1, 0, true, 1);
        t.ok(cf.boxEndIndex - cf.boxStartIndex < 45);
        t.end();
    });

    test('height is big enough that first box can be placed *after* anchor', (t) => {
        const line = [new Point(3103, 4068), new Point(3225.6206896551726, 4096)];
        const anchor = new Anchor(3144.5959947505007, 4077.498298013894, 0.22449735614507618, 0);
        const shaping = { right: 256, left: 0, bottom: 256, top: 0 };
        const cf = new CollisionFeature(collisionBoxArray, line, anchor, 0, 0, 0, shaping, 1, 0, true, 1);
        t.equal(cf.boxEndIndex - cf.boxStartIndex, 1);
        t.end();
    });

    t.end();

    function pluckAnchorPoints(cf) {
        const result = [];
        for (let i = cf.boxStartIndex; i < cf.boxEndIndex; i++) {
            result.push(collisionBoxArray.get(i).anchorPoint);
        }
        return result;
    }

    function pluckDistancesToAnchor(cf) {
        const result = [];
        for (let i = cf.boxStartIndex; i < cf.boxEndIndex; i++) {
            result.push(collisionBoxArray.get(i).signedDistanceFromAnchor);
        }
        return result;
    }
});
