import {describe, test, expect} from "../../util/vitest.js";
import EdgeInsets from '../../../src/geo/edge_insets.js';

describe('EdgeInsets', () => {
    describe('#constructor', () => {
        expect(new EdgeInsets() instanceof EdgeInsets).toBeTruthy();
        expect(() => {
            new EdgeInsets(NaN, 10);
        }).toThrowError(`Invalid value for edge-insets, top, bottom, left and right must all be numbers`);
        expect(() => {
            new EdgeInsets(-10, 10, 20, 10);
        }).toThrowError(`Invalid value for edge-insets, top, bottom, left and right must all be numbers`);

        test('valid initialization', () => {
            const top = 10;
            const bottom = 15;
            const left = 26;
            const right = 19;

            const inset = new EdgeInsets(top, bottom, left, right);
            expect(inset.top).toEqual(top);
            expect(inset.bottom).toEqual(bottom);
            expect(inset.left).toEqual(left);
            expect(inset.right).toEqual(right);
        });
    });

    describe('#getCenter', () => {
        test('valid input', () => {
            const inset = new EdgeInsets(10, 15, 50, 10);
            const center = inset.getCenter(600, 400);
            expect(center.x).toEqual(320);
            expect(center.y).toEqual(197.5);
        });

        test('center clamping', () => {
            const inset = new EdgeInsets(300, 200, 500, 200);
            const center = inset.getCenter(600, 400);
            // Midpoint of the overlap when padding overlaps
            expect(center.x).toEqual(450);
            expect(center.y).toEqual(250);
        });
    });

    describe('#interpolate', () => {
        test('it works', () => {
            const inset1 = new EdgeInsets(10, 15, 50, 10);
            const inset2 = new EdgeInsets(20, 30, 100, 10);
            const inset3 = inset1.interpolate(inset1, inset2, 0.5);
            // inset1 is mutated in-place
            expect(inset3).toEqual(inset1);

            expect(inset3.top).toEqual(15);
            expect(inset3.bottom).toEqual(22.5);
            expect(inset3.left).toEqual(75);
            expect(inset3.right).toEqual(10);
        });

        test('it retains insets that dont have new parameters passed in', () => {
            const inset = new EdgeInsets(10, 15, 50, 10);
            const target = {
                top: 20
            };
            inset.interpolate(inset, target, 0.5);
            expect(inset.top).toEqual(15);
            expect(inset.bottom).toEqual(15);
            expect(inset.left).toEqual(50);
            expect(inset.right).toEqual(10);
        });
    });

    test('#equals', () => {
        const inset1 = new EdgeInsets(10, 15, 50, 10);
        const inset2 = new EdgeInsets(10, 15, 50, 10);
        const inset3 = new EdgeInsets(10, 15, 50, 11);
        expect(inset1.equals(inset2)).toBeTruthy();
        expect(inset2.equals(inset3)).toBeFalsy();
    });

    test('#clone', () => {
        const inset1 = new EdgeInsets(10, 15, 50, 10);
        const inset2 = inset1.clone();
        expect(inset2 === inset1).toBeFalsy();
        expect(inset1.equals(inset2)).toBeTruthy();
    });
});
