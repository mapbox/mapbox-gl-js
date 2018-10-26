// @flow

import { test } from 'mapbox-gl-js-test';
import Color from '../../../src/style-spec/util/color';

test('Color.parse', (t) => {
    t.deepEqual(Color.parse('red'), new Color(1, 0, 0, 1));
    t.deepEqual(Color.parse('#ff00ff'), new Color(1, 0, 1, 1));
    t.deepEqual(Color.parse('invalid'), undefined);
    t.deepEqual(Color.parse(null), undefined);
    t.deepEqual(Color.parse(undefined), undefined);
    t.end();
});

test('Color#toString', (t) => {
    const purple = Color.parse('purple');
    t.equal(purple && purple.toString(), 'rgba(128,0,128,1)');
    const translucentGreen = Color.parse('rgba(26, 207, 26, .73)');
    t.equal(translucentGreen && translucentGreen.toString(), 'rgba(26,207,26,0.73)');
    t.end();
});
