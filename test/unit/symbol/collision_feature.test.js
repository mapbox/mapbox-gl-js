import {describe, test, expect} from "../../util/vitest.js";
import Anchor from '../../../src/symbol/anchor.js';
import {evaluateCircleCollisionFeature, evaluateBoxCollisionFeature} from '../../../src/symbol/symbol_layout.js';
import Point from '@mapbox/point-geometry';
import {CollisionBoxArray} from '../../../src/data/array_types.js';

describe('CollisionFeature', () => {
    const collisionBoxArray = new CollisionBoxArray();

    const shapedText = {
        left: -50,
        top: -10,
        right: 50,
        bottom: 10
    };

    test('point label', () => {
        const point = new Point(500, 0);
        const anchor = new Anchor(point.x, point.y, 0, 0, undefined);

        const index = evaluateBoxCollisionFeature(collisionBoxArray, anchor, anchor, 0, 0, 0, shapedText, 1, 0);
        expect(index).toEqual(0);

        const box = collisionBoxArray.get(index);
        expect(box.x1).toEqual(-50);
        expect(box.x2).toEqual(50);
        expect(box.y1).toEqual(-10);
        expect(box.y2).toEqual(10);
    });

    test('Compute line height for runtime collision circles (line label)', () => {
        const diameter = evaluateCircleCollisionFeature(shapedText);
        expect(diameter).toEqual(shapedText.bottom - shapedText.top);
    });

    test('Collision circle diameter is not computed for features with zero height', () => {
        const shapedText = {
            left: -50,
            top: -10,
            right: 50,
            bottom: -10
        };

        const diameter = evaluateCircleCollisionFeature(shapedText);
        expect(diameter).toBeFalsy();
    });

    test('Collision circle diameter is not computed for features with negative height', () => {
        const shapedText = {
            left: -50,
            top: 10,
            right: 50,
            bottom: -10
        };

        const diameter = evaluateCircleCollisionFeature(shapedText);
        expect(diameter).toBeFalsy();
    });

    test('Use minimum collision circle diameter', () => {
        const shapedText = {
            left: -50,
            top: 10,
            right: 50,
            bottom: 10.00001
        };

        const diameter = evaluateCircleCollisionFeature(shapedText);
        expect(diameter).toEqual(10);
    });
});
