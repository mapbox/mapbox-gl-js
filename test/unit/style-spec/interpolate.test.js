'use strict';

const test = require('mapbox-gl-js-test').test;
const interpolate = require('../../../src/style-spec/util/interpolate');

test('interpolate.number', (t) => {
    t.equal(interpolate(0, 1, 0.5), 0.5);
    t.end();
});

test('interpolate.number', (t) => {
    t.equal(interpolate.number(0, 1, 0.5), 0.5);
    t.end();
});

test('interpolate.vec2', (t) => {
    t.deepEqual(interpolate.vec2([0, 0], [1, 2], 0.5), [0.5, 1]);
    t.end();
});

test('interpolate.color', (t) => {
    t.deepEqual(interpolate.color([0, 0, 0, 0], [1, 2, 3, 4], 0.5), [0.5, 1, 3 / 2, 2]);
    t.end();
});

test('interpolate.array', (t) => {
    t.deepEqual(interpolate.array([0, 0, 0, 0], [1, 2, 3, 4], 0.5), [0.5, 1, 3 / 2, 2]);
    t.end();
});
