'use strict';

const test = require('mapbox-gl-js-test').test;
const createFunction = require('../../../src/style-spec/function');

test('constant function', (t) => {
    t.test('number', (t) => {
        const f = createFunction(1, {type: 'number'});

        t.equal(f(0), 1);
        t.equal(f(1), 1);
        t.equal(f(2), 1);

        t.end();
    });

    t.test('string', (t) => {
        const f = createFunction('mapbox', {type: 'string'});

        t.equal(f(0), 'mapbox');
        t.equal(f(1), 'mapbox');
        t.equal(f(2), 'mapbox');

        t.end();
    });

    t.test('color', (t) => {
        const f = createFunction('red', {type: 'color'});

        t.deepEqual(f(0), [1, 0, 0, 1]);
        t.deepEqual(f(1), [1, 0, 0, 1]);
        t.deepEqual(f(2), [1, 0, 0, 1]);

        t.end();
    });

    t.test('array', (t) => {
        const f = createFunction([1], {type: 'array'});

        t.deepEqual(f(0), [1]);
        t.deepEqual(f(1), [1]);
        t.deepEqual(f(2), [1]);

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
        });

        t.equal(f(2), 30 / 9);

        t.end();
    });

    t.test('base', (t) => {
        const f = createFunction({
            type: 'exponential',
            stops: [[1, 2], [3, 6]],
            base: 2
        }, {
            type: 'number'
        });

        t.equal(f(0), 2);
        t.equal(f(1), 2);
        t.equal(f(2), 30 / 9);
        t.equal(f(3), 6);
        t.equal(f(4), 6);

        t.end();
    });

    t.test('one stop', (t) => {
        const f = createFunction({
            type: 'exponential',
            stops: [[1, 2]]
        }, {
            type: 'number'
        });

        t.equal(f(0), 2);
        t.equal(f(1), 2);
        t.equal(f(2), 2);

        t.end();
    });

    t.test('two stops', (t) => {
        const f = createFunction({
            type: 'exponential',
            stops: [[1, 2], [3, 6]]
        }, {
            type: 'number'
        });

        t.equal(f(0), 2);
        t.equal(f(1), 2);
        t.equal(f(2), 4);
        t.equal(f(3), 6);
        t.equal(f(4), 6);

        t.end();
    });

    t.test('three stops', (t) => {
        const f = createFunction({
            type: 'exponential',
            stops: [[1, 2], [3, 6], [5, 10]]
        }, {
            type: 'number'
        });

        t.equal(f(0), 2);
        t.equal(f(1), 2);
        t.equal(f(2), 4);
        t.equal(f(2.5), 5);
        t.equal(f(3), 6);
        t.equal(f(4), 8);
        t.equal(f(4.5), 9);
        t.equal(f(5), 10);
        t.equal(f(6), 10);

        t.end();
    });

    t.test('four stops', (t) => {
        const f = createFunction({
            type: 'exponential',
            stops: [[1, 2], [3, 6], [5, 10], [7, 14]]
        }, {
            type: 'number'
        });

        t.equal(f(0), 2);
        t.equal(f(1), 2);
        t.equal(f(2), 4);
        t.equal(f(2.5), 5);
        t.equal(f(3), 6);
        t.equal(f(3.5), 7);
        t.equal(f(4), 8);
        t.equal(f(4.5), 9);
        t.equal(f(5), 10);
        t.equal(f(6), 12);
        t.equal(f(6.5), 13);
        t.equal(f(7), 14);
        t.equal(f(8), 14);

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
        });

        t.equal(f(2), 100);
        t.equal(f(20), 133.9622641509434);
        t.equal(f(607), 400);
        t.equal(f(680), 410.7352941176471);
        t.equal(f(4927), 1000); //86
        t.equal(f(7300), 14779.590419993057);
        t.equal(f(10000), 99125.30371398819);
        t.equal(f(20000), 3360628.527166095);
        t.equal(f(40000), 10000000);

        t.end();
    });

    t.test('color', (t) => {
        const f = createFunction({
            type: 'exponential',
            stops: [[1, 'red'], [11, 'blue']]
        }, {
            type: 'color'
        });

        t.deepEqual(f(0), [1, 0, 0, 1]);
        t.deepEqual(f(5), [0.6, 0, 0.4, 1]);
        t.deepEqual(f(11), [0, 0, 1, 1]);

        t.end();
    });

    t.test('lab colorspace', (t) => {
        const f = createFunction({
            type: 'exponential',
            colorSpace: 'lab',
            stops: [[1, [0, 0, 0, 1]], [10, [0, 1, 1, 1]]]
        }, {
            type: 'color'
        });

        t.deepEqual(f(0), [0, 0, 0, 1]);
        t.deepEqual(f(5).map((n) => {
            return parseFloat(n.toFixed(3));
        }), [0, 0.444, 0.444, 1]);

        t.end();
    });

    t.test('rgb colorspace', (t) => {
        const f = createFunction({
            type: 'exponential',
            colorSpace: 'rgb',
            stops: [[0, [0, 0, 0, 1]], [10, [1, 1, 1, 1]]]
        }, {
            type: 'color'
        });

        t.deepEqual(f(5).map((n) => {
            return parseFloat(n.toFixed(3));
        }), [0.5, 0.5, 0.5, 1]);

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
        });

        t.equal(f(0, {foo: 1}), 2);

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
        });

        t.equal(f(0, {}), 3);

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
        });

        t.equal(f(0, {}), 3);

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
        });

        t.equal(f(0, {foo: 'string'}), 3);

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
        });

        t.equal(f(0, {foo: 'string'}), 3);

        t.end();
    });

    t.test('zoom-and-property function, one stop', (t) => {
        const f = createFunction({
            type: 'exponential',
            property: 'prop',
            stops: [[{ zoom: 1, value: 1 }, 2]]
        }, {
            type: 'number'
        });

        t.equal(f(0, { prop: 0 }), 2);
        t.equal(f(1, { prop: 0 }), 2);
        t.equal(f(2, { prop: 0 }), 2);
        t.equal(f(0, { prop: 1 }), 2);
        t.equal(f(1, { prop: 1 }), 2);
        t.equal(f(2, { prop: 1 }), 2);
        t.equal(f(0, { prop: 2 }), 2);
        t.equal(f(1, { prop: 2 }), 2);
        t.equal(f(2, { prop: 2 }), 2);

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
        });

        t.equal(f(0, { prop: 1 }), 2);
        t.equal(f(1, { prop: 1 }), 2);
        t.equal(f(2, { prop: 1 }), 4);
        t.equal(f(3, { prop: 1 }), 6);
        t.equal(f(4, { prop: 1 }), 6);

        t.equal(f(2, { prop: -1}), 0);
        t.equal(f(2, { prop: 0}), 0);
        t.equal(f(2, { prop: 2}), 8);
        t.equal(f(2, { prop: 3}), 8);

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
        });

        t.equal(f(0, { prop: 1 }), 2);
        t.equal(f(1, { prop: 1 }), 2);
        t.equal(f(2, { prop: 1 }), 4);

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
        });

        t.equal(f(1.9, { prop: 1 }), 4);
        t.equal(f(2, { prop: 1 }), 6);
        t.equal(f(2.1, { prop: 1 }), 8);

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
        });

        t.equal(f(0, {}), undefined);
        t.equal(f(0.5, {}), undefined);
        t.equal(f(1, {}), undefined);

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
        });

        t.equal(f(-1.5), 11);
        t.equal(f(-0.5), 11);
        t.equal(f(0), 111);
        t.equal(f(0.5), 111);

        t.end();
    });

    t.test('one stop', (t) => {
        const f = createFunction({
            type: 'interval',
            stops: [[0, 11]]
        }, {
            type: 'number'
        });

        t.equal(f(-0.5), 11);
        t.equal(f(0), 11);
        t.equal(f(0.5), 11);

        t.end();
    });

    t.test('two stops', (t) => {
        const f = createFunction({
            type: 'interval',
            stops: [[-1, 11], [0, 111]]
        }, {
            type: 'number'
        });

        t.equal(f(-1.5), 11);
        t.equal(f(-0.5), 11);
        t.equal(f(0), 111);
        t.equal(f(0.5), 111);

        t.end();
    });

    t.test('three stops', (t) => {
        const f = createFunction({
            type: 'interval',
            stops: [[-1, 11], [0, 111], [1, 1111]]
        }, {
            type: 'number'
        });

        t.equal(f(-1.5), 11);
        t.equal(f(-0.5), 11);
        t.equal(f(0), 111);
        t.equal(f(0.5), 111);
        t.equal(f(1), 1111);
        t.equal(f(1.5), 1111);

        t.end();
    });

    t.test('four stops', (t) => {
        const f = createFunction({
            type: 'interval',
            stops: [[-1, 11], [0, 111], [1, 1111], [2, 11111]]
        }, {
            type: 'number'
        });

        t.equal(f(-1.5), 11);
        t.equal(f(-0.5), 11);
        t.equal(f(0), 111);
        t.equal(f(0.5), 111);
        t.equal(f(1), 1111);
        t.equal(f(1.5), 1111);
        t.equal(f(2), 11111);
        t.equal(f(2.5), 11111);

        t.end();
    });

    t.test('color', (t) => {
        const f = createFunction({
            type: 'interval',
            stops: [[1, 'red'], [11, 'blue']]
        }, {
            type: 'color'
        });

        t.deepEqual(f(0), [1, 0, 0, 1]);
        t.deepEqual(f(0), [1, 0, 0, 1]);
        t.deepEqual(f(11), [0, 0, 1, 1]);

        t.end();
    });

    t.test('property present', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'interval',
            stops: [[0, 'bad'], [1, 'good'], [2, 'bad']]
        }, {
            type: 'string'
        });

        t.equal(f(0, {foo: 1.5}), 'good');

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
        });

        t.equal(f(0, {}), 'default');

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
        });

        t.equal(f(0, {}), 'default');

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
        });

        t.equal(f(0, {foo: 'string'}), 'default');

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
        });

        t.equal(f(0, {foo: 'string'}), 'default');

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
        });

        t.equal(f(0, {foo: 0}), 'bad');
        t.equal(f(0, {foo: 1}), 'good');
        t.equal(f(0, {foo: 2}), 'bad');

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
        });

        t.equal(f(0, {}), 'default');
        t.equal(f(0, {foo: 3}), 'default');

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
        });

        const stringKeys = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [['0', 'zero'], ['1', 'one'], ['2', 'two'], ['true', 'yes'], ['false', 'no']],
            default: 'default'
        }, {
            type: 'string'
        });

        t.equal(numberKeys(0, {foo: '0'}), 'default');
        t.equal(numberKeys(0, {foo: '1'}), 'default');
        t.equal(numberKeys(0, {foo: false}), 'default');
        t.equal(numberKeys(0, {foo: true}), 'default');

        t.equal(stringKeys(0, {foo: 0}), 'default');
        t.equal(stringKeys(0, {foo: 1}), 'default');
        t.equal(stringKeys(0, {foo: false}), 'default');
        t.equal(stringKeys(0, {foo: true}), 'default');

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
        });

        t.equal(f(0, {}), 'default');
        t.equal(f(0, {foo: 3}), 'default');

        t.end();
    });

    t.test('color', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [[0, 'red'], [1, 'blue']]
        }, {
            type: 'color'
        });

        t.deepEqual(f(0, {foo: 0}), [1, 0, 0, 1]);
        t.deepEqual(f(1, {foo: 1}), [0, 0, 1, 1]);

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
        });

        t.deepEqual(f(0, {}), [0, 1, 0, 1]);
        t.deepEqual(f(0, {foo: 3}), [0, 1, 0, 1]);

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
        });

        t.deepEqual(f(0, {}), [0, 1, 0, 1]);
        t.deepEqual(f(0, {foo: 3}), [0, 1, 0, 1]);

        t.end();
    });

    t.test('boolean', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [[true, 'true'], [false, 'false']]
        }, {
            type: 'string'
        });

        t.equal(f(0, {foo: true}), 'true');
        t.equal(f(0, {foo: false}), 'false');

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
        });

        t.equal(f(0, {foo: 1}), 1);

        t.end();
    });

    t.test('number function default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'identity',
            default: 1
        }, {
            type: 'string'
        });

        t.equal(f(0, {}), 1);

        t.end();
    });

    t.test('number spec default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'string',
            default: 1
        });

        t.equal(f(0, {}), 1);

        t.end();
    });

    t.test('color', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'color'
        });

        t.deepEqual(f(0, {foo: 'red'}), [1, 0, 0, 1]);
        t.deepEqual(f(1, {foo: 'blue'}), [0, 0, 1, 1]);

        t.end();
    });

    t.test('color function default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'identity',
            default: 'red'
        }, {
            type: 'color'
        });

        t.deepEqual(f(0, {}), [1, 0, 0, 1]);

        t.end();
    });

    t.test('color spec default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'color',
            default: 'red'
        });

        t.deepEqual(f(0, {}), [1, 0, 0, 1]);

        t.end();
    });

    t.test('color invalid', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'color',
            default: 'red'
        });

        t.deepEqual(f(0, {foo: 'invalid'}), [1, 0, 0, 1]);

        t.end();
    });

    t.test('property type mismatch, function default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'identity',
            default: 'default'
        }, {
            type: 'string'
        });

        t.equal(f(0, {foo: 0}), 'default');

        t.end();
    });

    t.test('property type mismatch, spec default', (t) => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'string',
            default: 'default'
        });

        t.equal(f(0, {foo: 0}), 'default');

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

test('isConstant', (t) => {
    t.test('constant', (t) => {
        const f = createFunction(1, {
            type: 'string'
        });

        t.ok(f.isZoomConstant);
        t.ok(f.isFeatureConstant);

        t.end();
    });

    t.test('zoom', (t) => {
        const f = createFunction({
            stops: [[1, 1]]
        }, {
            type: 'string'
        });

        t.notOk(f.isZoomConstant);
        t.ok(f.isFeatureConstant);

        t.end();
    });

    t.test('property', (t) => {
        const f = createFunction({
            stops: [[1, 1]],
            property: 'mapbox'
        }, {
            type: 'string'
        });

        t.ok(f.isZoomConstant);
        t.notOk(f.isFeatureConstant);

        t.end();
    });

    t.test('zoom + property', (t) => {
        const f = createFunction({
            stops: [[{ zoom: 1, data: 1 }, 1]],
            property: 'mapbox'
        }, {
            type: 'string'
        });

        t.notOk(f.isZoomConstant);
        t.notOk(f.isFeatureConstant);

        t.end();
    });

    t.end();
});
