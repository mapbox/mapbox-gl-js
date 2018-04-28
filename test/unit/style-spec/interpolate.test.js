import { test } from 'mapbox-gl-js-test';
import * as interpolate from '../../../src/style-spec/util/interpolate';
import Color from '../../../src/style-spec/util/color';

test('interpolate.number', (t) => {
    t.equal(interpolate.number(0, 1, 0.5), 0.5);
    t.end();
});

test('interpolate.color', (t) => {
    t.deepEqual(interpolate.color(Color.parse('rgb(128,0,128)'), Color.parse('rgb(255,165,0)'), 0.5).toString(), 'rgba(192,83,64,1)');
    t.end();
});

test('interpolate.hcl', (t) => {
    t.deepEqual(interpolate.hcl(Color.parse('rgb(128,0,128)'), Color.parse('rgb(255,165,0)'), 0.5).toString(), 'rgba(236,46,83,1)');
    t.end();
});

test('interpolate.lab', (t) => {
    t.deepEqual(interpolate.lab(Color.parse('rgb(128,0,128)'), Color.parse('rgb(255,165,0)'), 0.5).toString(), 'rgba(197,93,91,1)');
    t.end();
});

test('interpolate.array', (t) => {
    t.deepEqual(interpolate.array([0, 0, 0, 0], [1, 2, 3, 4], 0.5), [0.5, 1, 3 / 2, 2]);
    t.end();
});
