import {test, expect} from "../../util/vitest.js";
import * as interpolate from '../../../src/style-spec/util/interpolate.js';
import Color from '../../../src/style-spec/util/color.js';

test('interpolate.number', () => {
    expect(interpolate.number(0, 1, 0.5)).toEqual(0.5);
});

test('interpolate.color', () => {
    expect(interpolate.color(new Color(0, 0, 0, 0), new Color(1, 2, 3, 4), 0.5)).toEqual(new Color(0.5, 1, 3 / 2, 2));
});

test('interpolate.array', () => {
    expect(interpolate.array([0, 0, 0, 0], [1, 2, 3, 4], 0.5)).toEqual([0.5, 1, 3 / 2, 2]);
});
