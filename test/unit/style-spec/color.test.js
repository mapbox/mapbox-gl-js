import {test, expect} from "../../util/vitest.js";
import Color from '../../../src/style-spec/util/color.js';

test('Color.parse', () => {
    expect(Color.parse('red')).toEqual(new Color(1, 0, 0, 1));
    expect(Color.parse('#ff00ff')).toEqual(new Color(1, 0, 1, 1));
    expect(Color.parse('invalid')).toEqual(undefined);
    expect(Color.parse(null)).toEqual(undefined);
    expect(Color.parse(undefined)).toEqual(undefined);
});

test('Color#toString', () => {
    const purple = Color.parse('purple');
    expect(purple && purple.toString()).toEqual('rgba(128,0,128,1)');
    const translucentGreen = Color.parse('rgba(26, 207, 26, .73)');
    expect(translucentGreen && translucentGreen.toString()).toEqual('rgba(26,207,26,0.73)');
});
