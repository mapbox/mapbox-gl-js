'use strict';

var test = require('tap').test;
var interpolate = require('../../../js/util/interpolate');

test('interpolate.number', function(t) {
    t.equal(interpolate(0, 1, 0.5), 0.5);
    t.end();
});

test('interpolate.number', function(t) {
    t.equal(interpolate.number(0, 1, 0.5), 0.5);
    t.end();
});

test('interpolate.color', function(t) {
    t.deepEqual(interpolate.color([0, 0, 0, 0], [1, 2, 3, 4], 0.5), [0.5, 1, 3 / 2, 2]);
    t.end();
});

test('interpolate.array', function(t) {
    t.deepEqual(interpolate.array([0, 0, 0, 0], [1, 2, 3, 4], 0.5), [0.5, 1, 3 / 2, 2]);
    t.end();
});
