'use strict';

var test = require('tape');
var MapboxGLFunction = require('../');

test('interpolated, constant number', function(t) {
    var f = MapboxGLFunction.interpolated(0);
    t.equal(f(0), 0);
    t.equal(f(1), 0);
    t.end();
});

test('interpolated, constant array', function(t) {
    var f = MapboxGLFunction.interpolated([0, 0, 0, 1]);
    t.deepEqual(f(0), [0, 0, 0, 1]);
    t.deepEqual(f(1), [0, 0, 0, 1]);
    t.end();
});

test('interpolated, single stop', function(t) {
    var f = MapboxGLFunction.interpolated({stops: [[1, 1]]});
    t.equal(f(0), 1);
    t.equal(f(1), 1);
    t.equal(f(3), 1);
    t.end();
});

test('interpolated, default base', function(t) {
    var f = MapboxGLFunction.interpolated({stops: [[1, 1], [5, 10]]});
    t.equal(f(0), 1);
    t.equal(f(1), 1);
    t.equal(f(3), 5.5);
    t.equal(f(5), 10);
    t.equal(f(11), 10);
    t.end();
});

test('interpolated, specified base', function(t) {
    var f = MapboxGLFunction.interpolated({stops: [[1, 1], [5, 10]], base: 2});
    t.equal(f(0), 1);
    t.equal(f(1), 1);
    t.equal(f(3), 2.8);
    t.equal(f(5), 10);
    t.equal(f(11), 10);
    t.end();
});

test('interpolated, array', function(t) {
    var f = MapboxGLFunction.interpolated({stops: [[1, [1, 2]], [5, [5, 10]]]});
    t.deepEqual(f(0), [1, 2]);
    t.deepEqual(f(1), [1, 2]);
    t.deepEqual(f(3), [3, 6]);
    t.deepEqual(f(5), [5, 10]);
    t.deepEqual(f(11), [5, 10]);
    t.end();
});

test('piecewise-constant, constant number', function(t) {
    var f = MapboxGLFunction['piecewise-constant'](0);
    t.equal(f(0), 0);
    t.equal(f(1), 0);
    t.end();
});

test('piecewise-constant, constant array', function(t) {
    var f = MapboxGLFunction['piecewise-constant']([0, 0, 0, 1]);
    t.deepEqual(f(0), [0, 0, 0, 1]);
    t.deepEqual(f(1), [0, 0, 0, 1]);
    t.end();
});

test('piecewise-constant, single stop', function(t) {
    var f = MapboxGLFunction['piecewise-constant']({stops: [[1, "a"]]});
    t.equal(f(0), "a");
    t.equal(f(1), "a");
    t.equal(f(3), "a");
    t.end();
});

test('piecewise-constant, multiple stops', function(t) {
    var f = MapboxGLFunction['piecewise-constant']({stops: [[1, "a"], [3, "b"], [4, "c"]]});
    t.equal(f(0), "a");
    t.equal(f(1), "a");
    t.equal(f(2), "a");
    t.equal(f(3), "b");
    t.equal(f(4), "c");
    t.equal(f(5), "c");
    t.end();
});
