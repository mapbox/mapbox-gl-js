import { test } from 'mapbox-gl-js-test';
import * as interpolate from '../../../src/style-spec/util/interpolate';
import Color from '../../../src/style-spec/util/color';

test('interpolate.number', (t) => {
    t.equal(interpolate.number(0, 1, 0.5), 0.5);
    t.end();
});

test('interpolate.color', (t) => {
    t.deepEqual(interpolate.color(new Color(0, 0, 0, 0), new Color(1, 2, 3, 4), 0.5), new Color(0.5, 1, 3 / 2, 2));
    t.end();
});

test('interpolate.array', (t) => {
    t.deepEqual(interpolate.array([0, 0, 0, 0], [1, 2, 3, 4], 0.5), [0.5, 1, 3 / 2, 2]);
    t.end();
});
