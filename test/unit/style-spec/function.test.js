'use strict';

import { test } from 'mapbox-gl-js-test';
import { createFunction } from '../../../src/style-spec/function';
import Color from '../../../src/style-spec/util/color';

test('binary search', (t) => {
    t.test('will eventually terminate.', (t) => {
        const f = createFunction({
            stops: [[9, 10], [17, 11], [17, 11], [18, 13]],
            base: 2
        }, {
            type: 'number',
            function: 'interpolated'
        }).evaluate;

        t.equal(f({zoom: 17}), 11);

        t.end();
    });
    t.end();
});

test('exponential function', (t) => {
    t.test('is the default for interpolated properties', (t) => {
        const f = createFunction({
            stops: [[1, 2], [3, 6]],
            base: 2
        }, {
            type: 'number',
            function: 'interpolated'
        }).evaluate;

        t.equalWithPrecision(f({zoom: 2}), 30 / 9, 1e-6);

        t.end();
    });

    t.test('base', (t) => {
        const f = createFunction({
            type: 'exponential',
            stops: [[1, 2], [3, 6]],
            base: 2
        }, {
            type: 'number'
        }).evaluate;

        t.equalWithPrecision(f({zoom: 0}), 2, 1e-6);
        t.equalWithPrecision(f({zoom: 1}), 2, 1e-6);
        t.equalWithPrecision(f({zoom: 2}), 30 / 9, 1e-6);
        t.equalWithPrecision(f({zoom: 3}), 6, 1e-6);
        t.equalWithPrecision(f({zoom: 4}), 6, 1e-6);

        t.end();
    });

    t.test('one stop', (t) => {
        const f = createFunction({
            type: 'exponential',
            stops: [[1, 2]]
        }, {
            type: 'number'
        }).evaluate;

        t.equal(f({zoom: 0}), 2);
        t.equal(f({zoom: 1}), 2);
        t.equal(f({zoom: 2}), 2);

        t.end();
    });

    t.test('two stops', (t) => {
        const f = createFunction({
            type: 'exponential',
            stops: [[1, 2], [3, 6]]
        }, {
            type: 'number'
        }).evaluate;

        t.equal(f({zoom: 0}), 2);
        t.equal(f({zoom: 1}), 2);
        t.equal(f({zoom: 2}), 4);
        t.equal(f({zoom: 3}), 6);
        t.equal(f({zoom: 4}), 6);

        t.end();
    });

    t.test('three stops', (t) => {
        const f = createFunction({
            type: 'exponential',
            stops: [[1, 2], [3, 6], [5, 10]]
        }, {
            type: 'number'
        }).evaluate;

        t.equal(f({zoom: 0}), 2);
        t.equal(f({zoom: 1}), 2);
        t.equal(f({zoom: 2}), 4);
        t.equal(f({zoom: 2.5}), 5);
        t.equal(f({zoom: 3}), 6);
        t.equal(f({zoom: 4}), 8);
        t.equal(f({zoom: 4.5}), 9);
        t.equal(f({zoom: 5}), 10);
        t.equal(f({zoom: 6}), 10);

        t.end();
    });

    t.test('four stops', (t) => {
        const f = createFunction({
            type: 'exponential',
            stops: [[1, 2], [3, 6], [5, 10], [7, 14]]
        }, {
            type: 'number'
        }).evaluate;

        t.equal(f({zoom: 0}), 2);
        t.equal(f({zoom: 1}), 2);
        t.equal(f({zoom: 2}), 4);
        t.equal(f({zoom: 2.5}), 5);
        t.equal(f({zoom: 3}), 6);
        t.equal(f({zoom: 3.5}), 7);
        t.equal(f({zoom: 4}), 8);
        t.equal(f({zoom: 4.5}), 9);
        t.equal(f({zoom: 5}), 10);
        t.equal(f({zoom: 6}), 12);
        t.equal(f({zoom: 6.5}), 13);
        t.equal(f({zoom: 7}), 14);
        t.equal(f({zoom: 8}), 14);

        t.end();
    });

    t.test('many stops', (t) => {
        const stops = [
            [2, 100],
            [55, 200],
            [132, 300],
            [607, 400],
            [1287, 500],
            [1985, 600],
            [2650, 700],
            [3299, 800],
            [3995, 900],
            [4927, 1000],
            [7147, 10000], // 10
            [10028, 100000], // 11
            [12889, 1000000],
            [40000, 10000000]
        ];
        const f = createFunction({
            type: 'exponential',
            stops: stops
        }, {
            type: 'number'
        }).evaluate;

        t.equalWithPrecision(f({zoom: 2}), 100, 1e-6);
        t.equalWithPrecision(f({zoom: 20}), 133.9622641509434, 1e-6);
        t.equalWithPrecision(f({zoom: 607}), 400, 1e-6);
        t.equalWithPrecision(f({zoom: 680}), 410.7352941176471, 1e-6);
        t.equalWithPrecision(f({zoom: 4927}), 1000, 1e-6); //86
        t.equalWithPrecision(f({zoom: 7300}), 14779.590419993057, 1e-6);
        t.equalWithPrecision(f({zoom: 10000}), 99125.30371398819, 1e-6);
        t.equalWithPrecision(f({zoom: 20000}), 3360628.527166095, 1e-6);
        t.equalWithPrecision(f({zoom: 40000}), 10000000, 1e-6);

        t.end();
    });

    t.test('color', (t) => {
        const f = createFunction({
            type: 'exponential',
            stops: [[1, 'red'], [11, 'blue']]
        }, {
            type: 'color'
        }).evaluate;

        t.deepEqual(f({zoom: 0}), new Color(1, 0, 0, 1));
        t.deepEqual(f({zoom: 5}), new Color(0.6, 0, 0.4, 1));
        t.deepEqual(f({zoom: 11}), new Color(0, 0, 1, 1));

        t.end();
    });

    t.test('lab colorspace', (t) => {
        const f = createFunction({
            type: 'exponential',
            colorSpace: 'lab',
            stops: [[1, 'rgba(0,0,0,1)'], [10, 'rgba(0,255,255,1)']]
        }, {
            type: 'color'
        }).evaluate;

        t.deepEqual(f({zoom: 0}), new Color(0, 0, 0, 1));
        t.equalWithPrecision(f({zoom: 5}).r, 0, 1e-6);
        t.equalWithPrecision(f({zoom: 5}).g, 0.444, 1e-3);
        t.equalWithPrecision(f({zoom: 5}).b, 0.444, 1e-3);

        t.end();
    });

    t.test('rgb colorspace', (t) => {
        const f = createFunction({
            type: 'exponential',
            colorSpace: 'rgb',
            stops: [[0, 'rgba(0,0,0,1)'], [10, 'rgba(255,255,255,1)']]
        }, {
            type: 'color'
        }).evaluate;

        t.deepEqual(f({zoom: 5}), new Color(0.5, 0.5, 0.5, 1));

        t.end();
    });

    t.test('unknown color spaces', (t) => {
        t.throws(() => {
            createFunction({
                type: 'exponential',
                colorSpace: 'unknown',
                stops: [[1, [0, 0, 0, 1]], [10, [0, 1, 1, 1]]]
            }, {
                type: 'color'
            });
        }, 'Unknown color space: unknown');

        t.end();
    });

    t.test('interpolation mutation avoidance', (t) => {
        const params = {
            type: 'exponential',
            colorSpace: 'lab',
            stops: [[1, [0, 0, 0, 1]], [10, [0, 1, 1, 1]]]
        };
        const paramsCopy = JSON.parse(JSON.stringify(params));
        createFunction(params, {
            type: 'color'
        });
        t.deepEqual(params, paramsCopy);
        t.end();
    });

    t.test('property present', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'exponential',
            stops: [[0, 0], [1, 2]]
        }, {
            type: 'number'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {foo: 1}}), 2);

        t.end();
    });

    t.test('property absent, function default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'exponential',
            stops: [[0, 0], [1, 2]],
            default: 3
        }, {
            type: 'number'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {}}), 3);

        t.end();
    });

    t.test('property absent, spec default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'exponential',
            stops: [[0, 0], [1, 2]]
        }, {
            type: 'number',
            default: 3
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {}}), 3);

        t.end();
    });

    t.test('property type mismatch, function default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'exponential',
            stops: [[0, 0], [1, 2]],
            default: 3
        }, {
            type: 'string'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {foo: 'string'}}), 3);

        t.end();
    });

    t.test('property type mismatch, spec default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'exponential',
            stops: [[0, 0], [1, 2]]
        }, {
            type: 'string',
            default: 3
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {foo: 'string'}}), 3);

        t.end();
    });

    t.test('zoom-and-property function, one stop', (t) => {
        const f = createFunction({
            type: 'exponential',
            property: 'prop',
            stops: [[{ zoom: 1, value: 1 }, 2]]
        }, {
            type: 'number'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: { prop: 0 }}), 2);
        t.equal(f({zoom: 1}, {properties: { prop: 0 }}), 2);
        t.equal(f({zoom: 2}, {properties: { prop: 0 }}), 2);
        t.equal(f({zoom: 0}, {properties: { prop: 1 }}), 2);
        t.equal(f({zoom: 1}, {properties: { prop: 1 }}), 2);
        t.equal(f({zoom: 2}, {properties: { prop: 1 }}), 2);
        t.equal(f({zoom: 0}, {properties: { prop: 2 }}), 2);
        t.equal(f({zoom: 1}, {properties: { prop: 2 }}), 2);
        t.equal(f({zoom: 2}, {properties: { prop: 2 }}), 2);

        t.end();
    });

    t.test('zoom-and-property function, two stops', (t) => {
        const f = createFunction({
            type: 'exponential',
            property: 'prop',
            base: 1,
            stops: [
                [{ zoom: 1, value: 0 }, 0],
                [{ zoom: 1, value: 2 }, 4],
                [{ zoom: 3, value: 0 }, 0],
                [{ zoom: 3, value: 2 }, 12]]
        }, {
            type: 'number'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: { prop: 1 }}), 2);
        t.equal(f({zoom: 1}, {properties: { prop: 1 }}), 2);
        t.equal(f({zoom: 2}, {properties: { prop: 1 }}), 4);
        t.equal(f({zoom: 3}, {properties: { prop: 1 }}), 6);
        t.equal(f({zoom: 4}, {properties: { prop: 1 }}), 6);

        t.equal(f({zoom: 2}, {properties: { prop: -1}}), 0);
        t.equal(f({zoom: 2}, {properties: { prop: 0}}), 0);
        t.equal(f({zoom: 2}, {properties: { prop: 2}}), 8);
        t.equal(f({zoom: 2}, {properties: { prop: 3}}), 8);

        t.end();
    });

    t.test('zoom-and-property function, three stops', (t) => {
        const f = createFunction({
            type: 'exponential',
            property: 'prop',
            base: 1,
            stops: [
                [{ zoom: 1, value: 0}, 0],
                [{ zoom: 1, value: 2}, 4],
                [{ zoom: 3, value: 0}, 0],
                [{ zoom: 3, value: 2}, 12],
                [{ zoom: 5, value: 0}, 0],
                [{ zoom: 5, value: 2}, 20]]
        }, {
            type: 'number'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: { prop: 1 }}), 2);
        t.equal(f({zoom: 1}, {properties: { prop: 1 }}), 2);
        t.equal(f({zoom: 2}, {properties: { prop: 1 }}), 4);

        t.end();
    });

    t.test('zoom-and-property function, two stops, fractional zoom', (t) => {
        const f = createFunction({
            type: 'exponential',
            property: 'prop',
            base: 1,
            stops: [
                [{ zoom: 1.9, value: 0 }, 4],
                [{ zoom: 2.1, value: 0 }, 8]
            ]
        }, {
            type: 'number'
        }).evaluate;

        t.equal(f({zoom: 1.9}, {properties: { prop: 1 }}), 4);
        t.equal(f({zoom: 2}, {properties: { prop: 1 }}), 6);
        t.equal(f({zoom: 2.1}, {properties: { prop: 1 }}), 8);

        t.end();
    });

    test('zoom-and-property function, four stops, integer and fractional zooms', (t) => {
        const f = createFunction({
            type: 'exponential',
            property: 'prop',
            base: 1,
            stops: [
                [{ zoom: 1, value: 0 }, 0],
                [{ zoom: 1.5, value: 0 }, 1],
                [{ zoom: 2, value: 0 }, 10],
                [{ zoom: 2.5, value: 0 }, 20]
            ]
        }, {
            type: 'number'
        }).evaluate;

        t.equal(f({zoom: 1}, {properties: { prop: 0 }}), 0);
        t.equal(f({zoom: 1.5}, {properties: { prop: 0 }}), 1);
        t.equal(f({zoom: 2}, {properties: { prop: 0 }}), 10);
        t.equal(f({zoom: 2.5}, {properties: { prop: 0 }}), 20);

        t.end();
    });


    t.test('zoom-and-property function, no default', (t) => {
        // This can happen for fill-outline-color, where the spec has no default.

        const f = createFunction({
            type: 'exponential',
            property: 'prop',
            base: 1,
            stops: [
                [{ zoom: 0, value: 1 }, 'red'],
                [{ zoom: 1, value: 1 }, 'red']
            ]
        }, {
            type: 'color'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {}}), undefined);
        t.equal(f({zoom: 0.5}, {properties: {}}), undefined);
        t.equal(f({zoom: 1}, {properties: {}}), undefined);

        t.end();
    });

    t.end();
});

test('interval function', (t) => {
    t.test('is the default for piecewise-constant properties', (t) => {
        const f = createFunction({
            stops: [[-1, 11], [0, 111]]
        }, {
            type: 'number',
            function: 'piecewise-constant'
        }).evaluate;

        t.equal(f({zoom: -1.5}), 11);
        t.equal(f({zoom: -0.5}), 11);
        t.equal(f({zoom: 0}), 111);
        t.equal(f({zoom: 0.5}), 111);

        t.end();
    });

    t.test('one stop', (t) => {
        const f = createFunction({
            type: 'interval',
            stops: [[0, 11]]
        }, {
            type: 'number'
        }).evaluate;

        t.equal(f({zoom: -0.5}), 11);
        t.equal(f({zoom: 0}), 11);
        t.equal(f({zoom: 0.5}), 11);

        t.end();
    });

    t.test('two stops', (t) => {
        const f = createFunction({
            type: 'interval',
            stops: [[-1, 11], [0, 111]]
        }, {
            type: 'number'
        }).evaluate;

        t.equal(f({zoom: -1.5}), 11);
        t.equal(f({zoom: -0.5}), 11);
        t.equal(f({zoom: 0}), 111);
        t.equal(f({zoom: 0.5}), 111);

        t.end();
    });

    t.test('three stops', (t) => {
        const f = createFunction({
            type: 'interval',
            stops: [[-1, 11], [0, 111], [1, 1111]]
        }, {
            type: 'number'
        }).evaluate;

        t.equal(f({zoom: -1.5}), 11);
        t.equal(f({zoom: -0.5}), 11);
        t.equal(f({zoom: 0}), 111);
        t.equal(f({zoom: 0.5}), 111);
        t.equal(f({zoom: 1}), 1111);
        t.equal(f({zoom: 1.5}), 1111);

        t.end();
    });

    t.test('four stops', (t) => {
        const f = createFunction({
            type: 'interval',
            stops: [[-1, 11], [0, 111], [1, 1111], [2, 11111]]
        }, {
            type: 'number'
        }).evaluate;

        t.equal(f({zoom: -1.5}), 11);
        t.equal(f({zoom: -0.5}), 11);
        t.equal(f({zoom: 0}), 111);
        t.equal(f({zoom: 0.5}), 111);
        t.equal(f({zoom: 1}), 1111);
        t.equal(f({zoom: 1.5}), 1111);
        t.equal(f({zoom: 2}), 11111);
        t.equal(f({zoom: 2.5}), 11111);

        t.end();
    });

    t.test('color', (t) => {
        const f = createFunction({
            type: 'interval',
            stops: [[1, 'red'], [11, 'blue']]
        }, {
            type: 'color'
        }).evaluate;

        t.deepEqual(f({zoom: 0}), new Color(1, 0, 0, 1));
        t.deepEqual(f({zoom: 0}), new Color(1, 0, 0, 1));
        t.deepEqual(f({zoom: 11}), new Color(0, 0, 1, 1));

        t.end();
    });

    t.test('property present', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'interval',
            stops: [[0, 'bad'], [1, 'good'], [2, 'bad']]
        }, {
            type: 'string'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {foo: 1.5}}), 'good');

        t.end();
    });

    t.test('property absent, function default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'interval',
            stops: [[0, 'zero'], [1, 'one'], [2, 'two']],
            default: 'default'
        }, {
            type: 'string'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {}}), 'default');

        t.end();
    });

    t.test('property absent, spec default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'interval',
            stops: [[0, 'zero'], [1, 'one'], [2, 'two']]
        }, {
            type: 'string',
            default: 'default'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {}}), 'default');

        t.end();
    });

    t.test('property type mismatch, function default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'interval',
            stops: [[0, 'zero'], [1, 'one'], [2, 'two']],
            default: 'default'
        }, {
            type: 'string'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {foo: 'string'}}), 'default');

        t.end();
    });

    t.test('property type mismatch, spec default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'interval',
            stops: [[0, 'zero'], [1, 'one'], [2, 'two']]
        }, {
            type: 'string',
            default: 'default'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {foo: 'string'}}), 'default');

        t.end();
    });

    t.end();
});

test('categorical function', (t) => {
    t.test('string', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [[0, 'bad'], [1, 'good'], [2, 'bad']]
        }, {
            type: 'string'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {foo: 0}}), 'bad');
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), 'good');
        t.equal(f({zoom: 0}, {properties: {foo: 2}}), 'bad');

        t.end();
    });

    t.test('string function default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [[0, 'zero'], [1, 'one'], [2, 'two']],
            default: 'default'
        }, {
            type: 'string'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {}}), 'default');
        t.equal(f({zoom: 0}, {properties: {foo: 3}}), 'default');

        t.end();
    });

    t.test('string zoom-and-property function default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [[{zoom: 0, value: 'bar'}, 'zero']],
            default: 'default'
        }, {
            type: 'string',
            function: 'interval'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {}}), 'default');
        t.equal(f({zoom: 0}, {properties: {foo: 3}}), 'default');
        t.equal(f({zoom: 0}, {properties: {foo: 'bar'}}), 'zero');

        t.end();
    });

    t.test('strict type checking', (t) => {
        const numberKeys = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [[0, 'zero'], [1, 'one'], [2, 'two']],
            default: 'default'
        }, {
            type: 'string'
        }).evaluate;

        const stringKeys = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [['0', 'zero'], ['1', 'one'], ['2', 'two'], ['true', 'yes'], ['false', 'no']],
            default: 'default'
        }, {
            type: 'string'
        }).evaluate;

        t.equal(numberKeys(0, {properties: {foo: '0'}}), 'default');
        t.equal(numberKeys(0, {properties: {foo: '1'}}), 'default');
        t.equal(numberKeys(0, {properties: {foo: false}}), 'default');
        t.equal(numberKeys(0, {properties: {foo: true}}), 'default');

        t.equal(stringKeys(0, {properties: {foo: 0}}), 'default');
        t.equal(stringKeys(0, {properties: {foo: 1}}), 'default');
        t.equal(stringKeys(0, {properties: {foo: false}}), 'default');
        t.equal(stringKeys(0, {properties: {foo: true}}), 'default');

        t.end();
    });


    t.test('string spec default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [[0, 'zero'], [1, 'one'], [2, 'two']]
        }, {
            type: 'string',
            default: 'default'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {}}), 'default');
        t.equal(f({zoom: 0}, {properties: {foo: 3}}), 'default');

        t.end();
    });

    t.test('color', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [[0, 'red'], [1, 'blue']]
        }, {
            type: 'color'
        }).evaluate;

        t.deepEqual(f({zoom: 0}, {properties: {foo: 0}}), new Color(1, 0, 0, 1));
        t.deepEqual(f({zoom: 1}, {properties: {foo: 1}}), new Color(0, 0, 1, 1));

        t.end();
    });

    t.test('color function default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [[0, 'red'], [1, 'blue']],
            default: 'lime'
        }, {
            type: 'color'
        }).evaluate;

        t.deepEqual(f({zoom: 0}, {properties: {}}), new Color(0, 1, 0, 1));
        t.deepEqual(f({zoom: 0}, {properties: {foo: 3}}), new Color(0, 1, 0, 1));

        t.end();
    });

    t.test('color spec default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [[0, 'red'], [1, 'blue']]
        }, {
            type: 'color',
            default: 'lime'
        }).evaluate;

        t.deepEqual(f({zoom: 0}, {properties: {}}), new Color(0, 1, 0, 1));
        t.deepEqual(f({zoom: 0}, {properties: {foo: 3}}), new Color(0, 1, 0, 1));

        t.end();
    });

    t.test('boolean', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [[true, 'true'], [false, 'false']]
        }, {
            type: 'string'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {foo: true}}), 'true');
        t.equal(f({zoom: 0}, {properties: {foo: false}}), 'false');

        t.end();
    });

    t.end();
});

test('identity function', (t) => {
    t.test('number', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'number'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {foo: 1}}), 1);

        t.end();
    });

    t.test('number function default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'identity',
            default: 1
        }, {
            type: 'string'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {}}), 1);

        t.end();
    });

    t.test('number spec default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'string',
            default: 1
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {}}), 1);

        t.end();
    });

    t.test('color', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'color'
        }).evaluate;

        t.deepEqual(f({zoom: 0}, {properties: {foo: 'red'}}), new Color(1, 0, 0, 1));
        t.deepEqual(f({zoom: 1}, {properties: {foo: 'blue'}}), new Color(0, 0, 1, 1));

        t.end();
    });

    t.test('color function default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'identity',
            default: 'red'
        }, {
            type: 'color'
        }).evaluate;

        t.deepEqual(f({zoom: 0}, {properties: {}}), new Color(1, 0, 0, 1));

        t.end();
    });

    t.test('color spec default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'color',
            default: 'red'
        }).evaluate;

        t.deepEqual(f({zoom: 0}, {properties: {}}), new Color(1, 0, 0, 1));

        t.end();
    });

    t.test('color invalid', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'color',
            default: 'red'
        }).evaluate;

        t.deepEqual(f({zoom: 0}, {properties: {foo: 'invalid'}}), new Color(1, 0, 0, 1));

        t.end();
    });

    t.test('property type mismatch, function default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'identity',
            default: 'default'
        }, {
            type: 'string'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {foo: 0}}), 'default');

        t.end();
    });

    t.test('property type mismatch, spec default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'string',
            default: 'default'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {foo: 0}}), 'default');

        t.end();
    });

    t.test('valid enum', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'enum',
            values: {
                bar: {}
            },
            default: 'def'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {foo: 'bar'}}), 'bar');

        t.end();
    });

    t.test('invalid enum, spec default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'enum',
            values: {
                bar: {}
            },
            default: 'def'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {foo: 'baz'}}), 'def');

        t.end();
    });

    t.test('invalid type for enum, spec default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'enum',
            values: {
                bar: {}
            },
            default: 'def'
        }).evaluate;

        t.equal(f({zoom: 0}, {properties: {foo: 3}}), 'def');

        t.end();
    });

    t.end();
});

test('unknown function', (t) => {
    t.throws(() => createFunction({
        type: 'nonesuch', stops: [[]]
    }, {
        type: 'string'
    }), /Unknown function type "nonesuch"/);
    t.end();
});

test('kind', (t) => {
    t.test('camera', (t) => {
        const f = createFunction({
            stops: [[1, 1]]
        }, {
            type: 'number'
        });

        t.equal(f.kind, 'camera');
        t.end();
    });

    t.test('source', (t) => {
        const f = createFunction({
            stops: [[1, 1]],
            property: 'mapbox'
        }, {
            type: 'number'
        });

        t.equal(f.kind, 'source');
        t.end();
    });

    t.test('composite', (t) => {
        const f = createFunction({
            stops: [[{ zoom: 1, value: 1 }, 1]],
            property: 'mapbox'
        }, {
            type: 'number'
        });

        t.equal(f.kind, 'composite');
        t.end();
    });

    t.end();
});
