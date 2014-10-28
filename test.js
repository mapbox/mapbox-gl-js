'use strict';

var test = require('tape').test;
var filter = require('./');

test('degenerate', function(t) {
    t.equal(filter()(), true);
    t.equal(filter(undefined)(), true);
    t.equal(filter(null)(), true);
    t.end();
});

test('==', function(t) {
    var f1 = filter(['==', 'foo', 'bar']);
    t.equal(f1({properties: {foo: 'bar'}}), true);
    t.equal(f1({properties: {foo: 'baz'}}), false);

    var f2 = filter(['==', 'foo', 0]);
    t.equal(f2({properties: {foo: 0}}), true);
    t.equal(f2({properties: {foo: 1}}), false);
    t.equal(f2({properties: {foo: '0'}}), false);
    t.equal(f2({properties: {foo: null}}), false);
    t.equal(f2({properties: {foo: undefined}}), false);

    var f3 = filter(['==', '$type', 'LineString']);
    t.equal(f3({type: 1}), false);
    t.equal(f3({type: 2}), true);

    var f4 = filter(['==', 'foo', 0]);
    t.equal(f4({properties: {}}), false);

    t.end();
});

test('!=', function(t) {
    var f1 = filter(['!=', 'foo', 'bar']);
    t.equal(f1({properties: {foo: 'bar'}}), false);
    t.equal(f1({properties: {foo: 'baz'}}), true);

    var f2 = filter(['!=', 'foo', 0]);
    t.equal(f2({properties: {foo: 0}}), false);
    t.equal(f2({properties: {foo: 1}}), true);
    t.equal(f2({properties: {foo: '0'}}), true);
    t.equal(f2({properties: {foo: null}}), true);
    t.equal(f2({properties: {foo: undefined}}), true);

    var f3 = filter(['!=', '$type', 'LineString']);
    t.equal(f3({type: 1}), true);
    t.equal(f3({type: 2}), false);

    var f4 = filter(['!=', 'foo', 0]);
    t.equal(f4({properties: {}}), true);

    t.end();
});

test('<', function(t) {
    var f1 = filter(['<', 'foo', 0]);
    t.equal(f1({properties: {foo: 1}}), false);
    t.equal(f1({properties: {foo: 0}}), false);
    t.equal(f1({properties: {foo: -1}}), true);
    t.equal(f1({properties: {foo: '1'}}), false);
    t.equal(f1({properties: {foo: '0'}}), false);
    t.equal(f1({properties: {foo: '-1'}}), false);

    var f2 = filter(['<', 'foo', '0']);
    t.equal(f2({properties: {foo: -1}}), false);
    t.equal(f2({properties: {foo: 0}}), false);
    t.equal(f2({properties: {foo: 1}}), false);
    t.equal(f2({properties: {foo: '1'}}), false);
    t.equal(f2({properties: {foo: '0'}}), false);
    t.equal(f2({properties: {foo: '-1'}}), true);
    t.equal(f2({properties: {foo: null}}), false);
    t.equal(f2({properties: {foo: undefined}}), false);

    var f3 = filter(['<', 'foo', 0]);
    t.equal(f3({properties: {}}), false);

    t.end();
});

test('<=', function(t) {
    var f1 = filter(['<=', 'foo', 0]);
    t.equal(f1({properties: {foo: 1}}), false);
    t.equal(f1({properties: {foo: 0}}), true);
    t.equal(f1({properties: {foo: -1}}), true);
    t.equal(f1({properties: {foo: '1'}}), false);
    t.equal(f1({properties: {foo: '0'}}), false);
    t.equal(f1({properties: {foo: '-1'}}), false);

    var f2 = filter(['<=', 'foo', '0']);
    t.equal(f2({properties: {foo: -1}}), false);
    t.equal(f2({properties: {foo: 0}}), false);
    t.equal(f2({properties: {foo: 1}}), false);
    t.equal(f2({properties: {foo: '1'}}), false);
    t.equal(f2({properties: {foo: '0'}}), true);
    t.equal(f2({properties: {foo: '-1'}}), true);
    t.equal(f2({properties: {foo: null}}), false);
    t.equal(f2({properties: {foo: undefined}}), false);

    var f3 = filter(['<=', 'foo', 0]);
    t.equal(f3({properties: {}}), false);

    t.end();
});

test('>', function(t) {
    var f1 = filter(['>', 'foo', 0]);
    t.equal(f1({properties: {foo: 1}}), true);
    t.equal(f1({properties: {foo: 0}}), false);
    t.equal(f1({properties: {foo: -1}}), false);
    t.equal(f1({properties: {foo: '1'}}), false);
    t.equal(f1({properties: {foo: '0'}}), false);
    t.equal(f1({properties: {foo: '-1'}}), false);

    var f2 = filter(['>', 'foo', '0']);
    t.equal(f2({properties: {foo: -1}}), false);
    t.equal(f2({properties: {foo: 0}}), false);
    t.equal(f2({properties: {foo: 1}}), false);
    t.equal(f2({properties: {foo: '1'}}), true);
    t.equal(f2({properties: {foo: '0'}}), false);
    t.equal(f2({properties: {foo: '-1'}}), false);
    t.equal(f2({properties: {foo: null}}), false);
    t.equal(f2({properties: {foo: undefined}}), false);

    var f3 = filter(['>', 'foo', 0]);
    t.equal(f3({properties: {}}), false);

    t.end();
});

test('>=', function(t) {
    var f1 = filter(['>=', 'foo', 0]);
    t.equal(f1({properties: {foo: 1}}), true);
    t.equal(f1({properties: {foo: 0}}), true);
    t.equal(f1({properties: {foo: -1}}), false);
    t.equal(f1({properties: {foo: '1'}}), false);
    t.equal(f1({properties: {foo: '0'}}), false);
    t.equal(f1({properties: {foo: '-1'}}), false);

    var f2 = filter(['>=', 'foo', '0']);
    t.equal(f2({properties: {foo: -1}}), false);
    t.equal(f2({properties: {foo: 0}}), false);
    t.equal(f2({properties: {foo: 1}}), false);
    t.equal(f2({properties: {foo: '1'}}), true);
    t.equal(f2({properties: {foo: '0'}}), true);
    t.equal(f2({properties: {foo: '-1'}}), false);
    t.equal(f2({properties: {foo: null}}), false);
    t.equal(f2({properties: {foo: undefined}}), false);

    var f3 = filter(['>=', 'foo', 0]);
    t.equal(f3({properties: {}}), false);

    t.end();
});

test('in', function(t) {
    var f1 = filter(['in', 'foo']);
    t.equal(f1({properties: {foo: 1}}), false);

    var f2 = filter(['in', 'foo', '0']);
    t.equal(f2({properties: {foo: 0}}), false);
    t.equal(f2({properties: {foo: '0'}}), true);
    t.equal(f2({properties: {foo: null}}), false);
    t.equal(f2({properties: {foo: undefined}}), false);

    var f3 = filter(['in', 'foo', 0]);
    t.equal(f3({properties: {foo: 0}}), true);
    t.equal(f3({properties: {foo: '0'}}), false);
    t.equal(f3({properties: {foo: null}}), false);
    t.equal(f3({properties: {foo: undefined}}), false);

    var f4 = filter(['in', 'foo', 0, 1]);
    t.equal(f4({properties: {foo: 0}}), true);
    t.equal(f4({properties: {foo: 1}}), true);
    t.equal(f4({properties: {foo: 3}}), false);

    var f5 = filter(['in', '$type', 'LineString', 'Polygon']);
    t.equal(f5({type: 1}), false);
    t.equal(f5({type: 2}), true);
    t.equal(f5({type: 3}), true);

    var f6 = filter(['in', 'foo', 0]);
    t.equal(f6({properties: {}}), false);

    t.end();
});

test('!in', function(t) {
    var f1 = filter(['!in', 'foo']);
    t.equal(f1({properties: {foo: 1}}), true);

    var f2 = filter(['!in', 'foo', '0']);
    t.equal(f2({properties: {foo: 0}}), true);
    t.equal(f2({properties: {foo: '0'}}), false);
    t.equal(f2({properties: {foo: null}}), true);
    t.equal(f2({properties: {foo: undefined}}), true);

    var f3 = filter(['!in', 'foo', 0]);
    t.equal(f3({properties: {foo: 0}}), false);
    t.equal(f3({properties: {foo: '0'}}), true);
    t.equal(f3({properties: {foo: null}}), true);
    t.equal(f3({properties: {foo: undefined}}), true);

    var f4 = filter(['!in', 'foo', 0, 1]);
    t.equal(f4({properties: {foo: 0}}), false);
    t.equal(f4({properties: {foo: 1}}), false);
    t.equal(f4({properties: {foo: 3}}), true);

    var f5 = filter(['!in', '$type', 'LineString', 'Polygon']);
    t.equal(f5({type: 1}), true);
    t.equal(f5({type: 2}), false);
    t.equal(f5({type: 3}), false);

    var f6 = filter(['!in', 'foo', 0]);
    t.equal(f6({properties: {}}), true);

    t.end();
});

test('any', function(t) {
    var f1 = filter(['any']);
    t.equal(f1({properties: {foo: 1}}), false);

    var f2 = filter(['any', ['==', 'foo', 1]]);
    t.equal(f2({properties: {foo: 1}}), true);

    var f3 = filter(['any', ['==', 'foo', 0]]);
    t.equal(f3({properties: {foo: 1}}), false);

    var f4 = filter(['any', ['==', 'foo', 0], ['==', 'foo', 1]]);
    t.equal(f4({properties: {foo: 1}}), true);

    t.end();
});

test('all', function(t) {
    var f1 = filter(['all']);
    t.equal(f1({properties: {foo: 1}}), true);

    var f2 = filter(['all', ['==', 'foo', 1]]);
    t.equal(f2({properties: {foo: 1}}), true);

    var f3 = filter(['all', ['==', 'foo', 0]]);
    t.equal(f3({properties: {foo: 1}}), false);

    var f4 = filter(['all', ['==', 'foo', 0], ['==', 'foo', 1]]);
    t.equal(f4({properties: {foo: 1}}), false);

    t.end();
});

test('none', function(t) {
    var f1 = filter(['none']);
    t.equal(f1({properties: {foo: 1}}), true);

    var f2 = filter(['none', ['==', 'foo', 1]]);
    t.equal(f2({properties: {foo: 1}}), false);

    var f3 = filter(['none', ['==', 'foo', 0]]);
    t.equal(f3({properties: {foo: 1}}), true);

    var f4 = filter(['none', ['==', 'foo', 0], ['==', 'foo', 1]]);
    t.equal(f4({properties: {foo: 1}}), false);

    t.end();
});
