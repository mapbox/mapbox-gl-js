import {test, expect} from "../../util/vitest.js";
import Point from '@mapbox/point-geometry';
import checkMaxAngle from '../../../src/symbol/check_max_angle.js';
import Anchor from '../../../src/symbol/anchor.js';

test('line with no sharp angles', () => {
    const line = [ new Point(0, 0), new Point(20, -1), new Point(40, 1), new Point(60, 0) ];
    const anchor = new Anchor(30, 0, 0, 0, 1);
    expect(checkMaxAngle(line, anchor, 25, 20, Math.PI / 8)).toBeTruthy();
    expect(checkMaxAngle(line, anchor, 25, 20, 0)).toBeFalsy();
});

test('one sharp corner', () => {
    const line = [ new Point(0, 0), new Point(0, 10), new Point(10, 10) ];
    const anchor = new Anchor(0, 10, 0, 0, 1);
    expect(checkMaxAngle(line, anchor, 10, 5, Math.PI / 2)).toBeTruthy();
    expect(checkMaxAngle(line, anchor, 10, 5, Math.PI / 2 - 0.01)).toBeFalsy();
});

test('many small corners close together', () => {
    const line = [
        new Point(0, 0), new Point(10, 0), new Point(11, 0.1),
        new Point(12, 0.3), new Point(13, 0.6), new Point(14, 1), new Point(13.9, 10)];
    const anchor = new Anchor(12, 0.3, 0, 0, 3);
    expect(checkMaxAngle(line, anchor, 10, 5, Math.PI / 2)).toBeFalsy();
    expect(checkMaxAngle(line, anchor, 10, 2, Math.PI / 2)).toBeTruthy();
});

test('label appears on the first line segment', () => {
    const line = [ new Point(0, 0), new Point(100, 0) ];
    const anchor = new Point(50, 0, 0, 0);
    expect(checkMaxAngle(line, anchor, 30, 5, Math.PI / 2)).toBeTruthy();
});

test('not enough space before the end of the line', () => {
    const line = [ new Point(0, 0), new Point(10, 0), new Point(20, 0), new Point(30, 0) ];
    const anchor = new Anchor(5, 0,  0, 0, 0);
    expect(checkMaxAngle(line, anchor, 11, 5, Math.PI)).toBeFalsy();
    expect(checkMaxAngle(line, anchor, 10, 5, Math.PI)).toBeTruthy();
});

test('not enough space after the beginning of the line', () => {
    const line = [ new Point(0, 0), new Point(10, 0), new Point(20, 0), new Point(30, 0) ];
    const anchor = new Anchor(25, 0, 0, 0, 2);
    expect(checkMaxAngle(line, anchor, 11, 5, Math.PI)).toBeFalsy();
    expect(checkMaxAngle(line, anchor, 10, 5, Math.PI)).toBeTruthy();
});
