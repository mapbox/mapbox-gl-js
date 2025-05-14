// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect} from '../../util/vitest';
import * as interpolate from '../../../src/style-spec/util/interpolate';
import Color from '../../../src/style-spec/util/color';

test('interpolate.number', () => {
    expect(interpolate.number(0, 1, 0.5)).toEqual(0.5);
});

test('interpolate.color', () => {
    expect(interpolate.color(new Color(0, 0, 0, 0), new Color(1, 2, 3, 4), 0.5)).toEqual(new Color(0.5, 1, 3 / 2, 2));
});

test('interpolate.array', () => {
    expect(interpolate.array([0, 0, 0, 0], [1, 2, 3, 4], 0.5)).toEqual([0.5, 1, 3 / 2, 2]);
});
