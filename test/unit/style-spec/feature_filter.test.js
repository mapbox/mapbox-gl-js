'use strict';

const test = require('mapbox-gl-js-test').test;
const filter = require('../../../src/style-spec').featureFilter;

test('degenerate', (t) => {
    t.equal(filter()(), true);
    t.equal(filter(undefined)(), true);
    t.equal(filter(null)(), true);
    t.end();
});

test('==, string', (t) => {
    const f = filter(['==', 'foo', 'bar']);
    t.equal(f({properties: {foo: 'bar'}}), true);
    t.equal(f({properties: {foo: 'baz'}}), false);
    t.end();
});

test('==, number', (t) => {
    const f = filter(['==', 'foo', 0]);
    t.equal(f({properties: {foo: 0}}), true);
    t.equal(f({properties: {foo: 1}}), false);
    t.equal(f({properties: {foo: '0'}}), false);
    t.equal(f({properties: {foo: true}}), false);
    t.equal(f({properties: {foo: false}}), false);
    t.equal(f({properties: {foo: null}}), false);
    t.equal(f({properties: {foo: undefined}}), false);
    t.equal(f({properties: {}}), false);
    t.end();
});

test('==, null', (t) => {
    const f = filter(['==', 'foo', null]);
    t.equal(f({properties: {foo: 0}}), false);
    t.equal(f({properties: {foo: 1}}), false);
    t.equal(f({properties: {foo: '0'}}), false);
    t.equal(f({properties: {foo: true}}), false);
    t.equal(f({properties: {foo: false}}), false);
    t.equal(f({properties: {foo: null}}), true);
    t.equal(f({properties: {foo: undefined}}), false);
    t.equal(f({properties: {}}), false);
    t.end();
});

test('==, $type', (t) => {
    const f = filter(['==', '$type', 'LineString']);
    t.equal(f({type: 1}), false);
    t.equal(f({type: 2}), true);
    t.end();
});

test('==, $id', (t) => {
    const f = filter(['==', '$id', 1234]);

    t.equal(f({id: 1234}), true);
    t.equal(f({id: '1234'}), false);
    t.equal(f({properties: {id: 1234}}), false);

    t.end();
});

test('!=, string', (t) => {
    const f = filter(['!=', 'foo', 'bar']);
    t.equal(f({properties: {foo: 'bar'}}), false);
    t.equal(f({properties: {foo: 'baz'}}), true);
    t.end();
});

test('!=, number', (t) => {
    const f = filter(['!=', 'foo', 0]);
    t.equal(f({properties: {foo: 0}}), false);
    t.equal(f({properties: {foo: 1}}), true);
    t.equal(f({properties: {foo: '0'}}), true);
    t.equal(f({properties: {foo: true}}), true);
    t.equal(f({properties: {foo: false}}), true);
    t.equal(f({properties: {foo: null}}), true);
    t.equal(f({properties: {foo: undefined}}), true);
    t.equal(f({properties: {}}), true);
    t.end();
});

test('!=, null', (t) => {
    const f = filter(['!=', 'foo', null]);
    t.equal(f({properties: {foo: 0}}), true);
    t.equal(f({properties: {foo: 1}}), true);
    t.equal(f({properties: {foo: '0'}}), true);
    t.equal(f({properties: {foo: true}}), true);
    t.equal(f({properties: {foo: false}}), true);
    t.equal(f({properties: {foo: null}}), false);
    t.equal(f({properties: {foo: undefined}}), true);
    t.equal(f({properties: {}}), true);
    t.end();
});

test('!=, $type', (t) => {
    const f = filter(['!=', '$type', 'LineString']);
    t.equal(f({type: 1}), true);
    t.equal(f({type: 2}), false);
    t.end();
});

test('<, number', (t) => {
    const f = filter(['<', 'foo', 0]);
    t.equal(f({properties: {foo: 1}}), false);
    t.equal(f({properties: {foo: 0}}), false);
    t.equal(f({properties: {foo: -1}}), true);
    t.equal(f({properties: {foo: '1'}}), false);
    t.equal(f({properties: {foo: '0'}}), false);
    t.equal(f({properties: {foo: '-1'}}), false);
    t.equal(f({properties: {foo: true}}), false);
    t.equal(f({properties: {foo: false}}), false);
    t.equal(f({properties: {foo: null}}), false);
    t.equal(f({properties: {foo: undefined}}), false);
    t.equal(f({properties: {}}), false);
    t.end();
});

test('<, string', (t) => {
    const f = filter(['<', 'foo', '0']);
    t.equal(f({properties: {foo: -1}}), false);
    t.equal(f({properties: {foo: 0}}), false);
    t.equal(f({properties: {foo: 1}}), false);
    t.equal(f({properties: {foo: '1'}}), false);
    t.equal(f({properties: {foo: '0'}}), false);
    t.equal(f({properties: {foo: '-1'}}), true);
    t.equal(f({properties: {foo: true}}), false);
    t.equal(f({properties: {foo: false}}), false);
    t.equal(f({properties: {foo: null}}), false);
    t.equal(f({properties: {foo: undefined}}), false);
    t.end();
});

test('<=, number', (t) => {
    const f = filter(['<=', 'foo', 0]);
    t.equal(f({properties: {foo: 1}}), false);
    t.equal(f({properties: {foo: 0}}), true);
    t.equal(f({properties: {foo: -1}}), true);
    t.equal(f({properties: {foo: '1'}}), false);
    t.equal(f({properties: {foo: '0'}}), false);
    t.equal(f({properties: {foo: '-1'}}), false);
    t.equal(f({properties: {foo: true}}), false);
    t.equal(f({properties: {foo: false}}), false);
    t.equal(f({properties: {foo: null}}), false);
    t.equal(f({properties: {foo: undefined}}), false);
    t.equal(f({properties: {}}), false);
    t.end();
});

test('<=, string', (t) => {
    const f = filter(['<=', 'foo', '0']);
    t.equal(f({properties: {foo: -1}}), false);
    t.equal(f({properties: {foo: 0}}), false);
    t.equal(f({properties: {foo: 1}}), false);
    t.equal(f({properties: {foo: '1'}}), false);
    t.equal(f({properties: {foo: '0'}}), true);
    t.equal(f({properties: {foo: '-1'}}), true);
    t.equal(f({properties: {foo: true}}), false);
    t.equal(f({properties: {foo: false}}), false);
    t.equal(f({properties: {foo: null}}), false);
    t.equal(f({properties: {foo: undefined}}), false);
    t.end();
});

test('>, number', (t) => {
    const f = filter(['>', 'foo', 0]);
    t.equal(f({properties: {foo: 1}}), true);
    t.equal(f({properties: {foo: 0}}), false);
    t.equal(f({properties: {foo: -1}}), false);
    t.equal(f({properties: {foo: '1'}}), false);
    t.equal(f({properties: {foo: '0'}}), false);
    t.equal(f({properties: {foo: '-1'}}), false);
    t.equal(f({properties: {foo: true}}), false);
    t.equal(f({properties: {foo: false}}), false);
    t.equal(f({properties: {foo: null}}), false);
    t.equal(f({properties: {foo: undefined}}), false);
    t.equal(f({properties: {}}), false);
    t.end();
});

test('>, string', (t) => {
    const f = filter(['>', 'foo', '0']);
    t.equal(f({properties: {foo: -1}}), false);
    t.equal(f({properties: {foo: 0}}), false);
    t.equal(f({properties: {foo: 1}}), false);
    t.equal(f({properties: {foo: '1'}}), true);
    t.equal(f({properties: {foo: '0'}}), false);
    t.equal(f({properties: {foo: '-1'}}), false);
    t.equal(f({properties: {foo: true}}), false);
    t.equal(f({properties: {foo: false}}), false);
    t.equal(f({properties: {foo: null}}), false);
    t.equal(f({properties: {foo: undefined}}), false);
    t.end();
});

test('>=, number', (t) => {
    const f = filter(['>=', 'foo', 0]);
    t.equal(f({properties: {foo: 1}}), true);
    t.equal(f({properties: {foo: 0}}), true);
    t.equal(f({properties: {foo: -1}}), false);
    t.equal(f({properties: {foo: '1'}}), false);
    t.equal(f({properties: {foo: '0'}}), false);
    t.equal(f({properties: {foo: '-1'}}), false);
    t.equal(f({properties: {foo: true}}), false);
    t.equal(f({properties: {foo: false}}), false);
    t.equal(f({properties: {foo: null}}), false);
    t.equal(f({properties: {foo: undefined}}), false);
    t.equal(f({properties: {}}), false);
    t.end();
});

test('>=, string', (t) => {
    const f = filter(['>=', 'foo', '0']);
    t.equal(f({properties: {foo: -1}}), false);
    t.equal(f({properties: {foo: 0}}), false);
    t.equal(f({properties: {foo: 1}}), false);
    t.equal(f({properties: {foo: '1'}}), true);
    t.equal(f({properties: {foo: '0'}}), true);
    t.equal(f({properties: {foo: '-1'}}), false);
    t.equal(f({properties: {foo: true}}), false);
    t.equal(f({properties: {foo: false}}), false);
    t.equal(f({properties: {foo: null}}), false);
    t.equal(f({properties: {foo: undefined}}), false);
    t.end();
});

test('in, degenerate', (t) => {
    const f = filter(['in', 'foo']);
    t.equal(f({properties: {foo: 1}}), false);
    t.end();
});

test('in, string', (t) => {
    const f = filter(['in', 'foo', '0']);
    t.equal(f({properties: {foo: 0}}), false);
    t.equal(f({properties: {foo: '0'}}), true);
    t.equal(f({properties: {foo: true}}), false);
    t.equal(f({properties: {foo: false}}), false);
    t.equal(f({properties: {foo: null}}), false);
    t.equal(f({properties: {foo: undefined}}), false);
    t.equal(f({properties: {}}), false);
    t.end();
});

test('in, number', (t) => {
    const f = filter(['in', 'foo', 0]);
    t.equal(f({properties: {foo: 0}}), true);
    t.equal(f({properties: {foo: '0'}}), false);
    t.equal(f({properties: {foo: true}}), false);
    t.equal(f({properties: {foo: false}}), false);
    t.equal(f({properties: {foo: null}}), false);
    t.equal(f({properties: {foo: undefined}}), false);
    t.end();
});

test('in, null', (t) => {
    const f = filter(['in', 'foo', null]);
    t.equal(f({properties: {foo: 0}}), false);
    t.equal(f({properties: {foo: '0'}}), false);
    t.equal(f({properties: {foo: true}}), false);
    t.equal(f({properties: {foo: false}}), false);
    t.equal(f({properties: {foo: null}}), true);
    t.equal(f({properties: {foo: undefined}}), false);
    t.end();
});

test('in, multiple', (t) => {
    const f = filter(['in', 'foo', 0, 1]);
    t.equal(f({properties: {foo: 0}}), true);
    t.equal(f({properties: {foo: 1}}), true);
    t.equal(f({properties: {foo: 3}}), false);
    t.end();
});

test('in, large_multiple', (t) => {
    const f = filter(['in', 'foo'].concat(Array.apply(null, {length: 2000}).map(Number.call, Number)));
    t.equal(f({properties: {foo: 0}}), true);
    t.equal(f({properties: {foo: 1}}), true);
    t.equal(f({properties: {foo: 1999}}), true);
    t.equal(f({properties: {foo: 2000}}), false);
    t.end();
});

test('in, $type', (t) => {
    const f = filter(['in', '$type', 'LineString', 'Polygon']);
    t.equal(f({type: 1}), false);
    t.equal(f({type: 2}), true);
    t.equal(f({type: 3}), true);

    const f1 = filter(['in', '$type', 'Polygon', 'LineString', 'Point']);
    t.equal(f1({type: 1}), true);
    t.equal(f1({type: 2}), true);
    t.equal(f1({type: 3}), true);

    t.end();
});

test('!in, degenerate', (t) => {
    const f = filter(['!in', 'foo']);
    t.equal(f({properties: {foo: 1}}), true);
    t.end();
});

test('!in, string', (t) => {
    const f = filter(['!in', 'foo', '0']);
    t.equal(f({properties: {foo: 0}}), true);
    t.equal(f({properties: {foo: '0'}}), false);
    t.equal(f({properties: {foo: null}}), true);
    t.equal(f({properties: {foo: undefined}}), true);
    t.equal(f({properties: {}}), true);
    t.end();
});

test('!in, number', (t) => {
    const f = filter(['!in', 'foo', 0]);
    t.equal(f({properties: {foo: 0}}), false);
    t.equal(f({properties: {foo: '0'}}), true);
    t.equal(f({properties: {foo: null}}), true);
    t.equal(f({properties: {foo: undefined}}), true);
    t.end();
});

test('!in, null', (t) => {
    const f = filter(['!in', 'foo', null]);
    t.equal(f({properties: {foo: 0}}), true);
    t.equal(f({properties: {foo: '0'}}), true);
    t.equal(f({properties: {foo: null}}), false);
    t.equal(f({properties: {foo: undefined}}), true);
    t.end();
});

test('!in, multiple', (t) => {
    const f = filter(['!in', 'foo', 0, 1]);
    t.equal(f({properties: {foo: 0}}), false);
    t.equal(f({properties: {foo: 1}}), false);
    t.equal(f({properties: {foo: 3}}), true);
    t.end();
});

test('!in, large_multiple', (t) => {
    const f = filter(['!in', 'foo'].concat(Array.apply(null, {length: 2000}).map(Number.call, Number)));
    t.equal(f({properties: {foo: 0}}), false);
    t.equal(f({properties: {foo: 1}}), false);
    t.equal(f({properties: {foo: 1999}}), false);
    t.equal(f({properties: {foo: 2000}}), true);
    t.end();
});

test('!in, $type', (t) => {
    const f = filter(['!in', '$type', 'LineString', 'Polygon']);
    t.equal(f({type: 1}), true);
    t.equal(f({type: 2}), false);
    t.equal(f({type: 3}), false);
    t.end();
});

test('any', (t) => {
    const f1 = filter(['any']);
    t.equal(f1({properties: {foo: 1}}), false);

    const f2 = filter(['any', ['==', 'foo', 1]]);
    t.equal(f2({properties: {foo: 1}}), true);

    const f3 = filter(['any', ['==', 'foo', 0]]);
    t.equal(f3({properties: {foo: 1}}), false);

    const f4 = filter(['any', ['==', 'foo', 0], ['==', 'foo', 1]]);
    t.equal(f4({properties: {foo: 1}}), true);

    t.end();
});

test('all', (t) => {
    const f1 = filter(['all']);
    t.equal(f1({properties: {foo: 1}}), true);

    const f2 = filter(['all', ['==', 'foo', 1]]);
    t.equal(f2({properties: {foo: 1}}), true);

    const f3 = filter(['all', ['==', 'foo', 0]]);
    t.equal(f3({properties: {foo: 1}}), false);

    const f4 = filter(['all', ['==', 'foo', 0], ['==', 'foo', 1]]);
    t.equal(f4({properties: {foo: 1}}), false);

    t.end();
});

test('none', (t) => {
    const f1 = filter(['none']);
    t.equal(f1({properties: {foo: 1}}), true);

    const f2 = filter(['none', ['==', 'foo', 1]]);
    t.equal(f2({properties: {foo: 1}}), false);

    const f3 = filter(['none', ['==', 'foo', 0]]);
    t.equal(f3({properties: {foo: 1}}), true);

    const f4 = filter(['none', ['==', 'foo', 0], ['==', 'foo', 1]]);
    t.equal(f4({properties: {foo: 1}}), false);

    t.end();
});

test('has', (t) => {
    const f = filter(['has', 'foo']);
    t.equal(f({properties: {foo: 0}}), true);
    t.equal(f({properties: {foo: 1}}), true);
    t.equal(f({properties: {foo: '0'}}), true);
    t.equal(f({properties: {foo: true}}), true);
    t.equal(f({properties: {foo: false}}), true);
    t.equal(f({properties: {foo: null}}), true);
    t.equal(f({properties: {foo: undefined}}), true);
    t.equal(f({properties: {}}), false);
    t.end();
});

test('!has', (t) => {
    const f = filter(['!has', 'foo']);
    t.equal(f({properties: {foo: 0}}), false);
    t.equal(f({properties: {foo: 1}}), false);
    t.equal(f({properties: {foo: '0'}}), false);
    t.equal(f({properties: {foo: false}}), false);
    t.equal(f({properties: {foo: false}}), false);
    t.equal(f({properties: {foo: null}}), false);
    t.equal(f({properties: {foo: undefined}}), false);
    t.equal(f({properties: {}}), true);
    t.end();
});
