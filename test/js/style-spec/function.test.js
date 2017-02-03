'use strict';

const test = require('mapbox-gl-js-test').test;
const createInterpolated = require('../../../js/style-spec/function').interpolated;
const createInterval = require('../../../js/style-spec/function')['piecewise-constant'];

test('constant function', (t) => {
    t.test('number', (t) => {
        const f = createInterpolated(1);

        t.equal(f(0), 1);
        t.equal(f(1), 1);
        t.equal(f(2), 1);

        t.end();
    });

    t.test('string', (t) => {
        const f = createInterpolated('mapbox');

        t.equal(f(0), 'mapbox');
        t.equal(f(1), 'mapbox');
        t.equal(f(2), 'mapbox');

        t.end();
    });

    t.test('array', (t) => {
        const f = createInterpolated([1]);

        t.deepEqual(f(0), [1]);
        t.deepEqual(f(1), [1]);
        t.deepEqual(f(2), [1]);

        t.end();
    });

    t.end();
});

test('exponential function', (t) => {
    t.test('is the default for interpolated properties', (t) => {
        const f = createInterpolated({
            stops: [[1, 2], [3, 6]],
            base: 2
        });

        t.equal(f(2), 30 / 9);

        t.end();
    });

    t.test('base', (t) => {
        const f = createInterpolated({
            type: 'exponential',
            stops: [[1, 2], [3, 6]],
            base: 2
        });

        t.equal(f(0), 2);
        t.equal(f(1), 2);
        t.equal(f(2), 30 / 9);
        t.equal(f(3), 6);
        t.equal(f(4), 6);

        t.end();
    });

    t.test('one stop', (t) => {
        const f = createInterpolated({
            type: 'exponential',
            stops: [[1, 2]]
        });

        t.equal(f(0), 2);
        t.equal(f(1), 2);
        t.equal(f(2), 2);

        t.end();
    });

    t.test('two stops', (t) => {
        const f = createInterpolated({
            type: 'exponential',
            stops: [[1, 2], [3, 6]]
        });

        t.equal(f(0), 2);
        t.equal(f(1), 2);
        t.equal(f(2), 4);
        t.equal(f(3), 6);
        t.equal(f(4), 6);

        t.end();
    });

    t.test('three stops', (t) => {
        const f = createInterpolated({
            type: 'exponential',
            stops: [[1, 2], [3, 6], [5, 10]]
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
        const f = createInterpolated({
            type: 'exponential',
            stops: [[1, 2], [3, 6], [5, 10], [7, 14]]
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
        const f = createInterpolated({
            type: 'exponential',
            stops: stops
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

    t.test('lab colorspace', (t) => {
        const f = createInterpolated({
            type: 'exponential',
            colorSpace: 'lab',
            stops: [[1, [0, 0, 0, 1]], [10, [0, 1, 1, 1]]]
        });

        t.deepEqual(f(0), [0, 0, 0, 1]);
        t.deepEqual(f(5).map((n) => {
            return parseFloat(n.toFixed(3));
        }), [0, 0.444, 0.444, 1]);

        t.end();
    });

    t.test('rgb colorspace', (t) => {
        const f = createInterpolated({
            type: 'exponential',
            colorSpace: 'rgb',
            stops: [[0, [0, 0, 0, 1]], [10, [1, 1, 1, 1]]]
        });

        t.deepEqual(f(5).map((n) => {
            return parseFloat(n.toFixed(3));
        }), [0.5, 0.5, 0.5, 1]);

        t.end();
    });

    t.test('unknown color spaces', (t) => {
        t.throws(() => {
            createInterpolated({
                type: 'exponential',
                colorSpace: 'unknown',
                stops: [[1, [0, 0, 0, 1]], [10, [0, 1, 1, 1]]]
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
        createInterpolated(params);
        t.deepEqual(params, paramsCopy);
        t.end();
    });

    t.test('property function', (t) => {
        const f = createInterpolated({
            property: 'foo',
            type: 'exponential',
            stops: [[0, 0], [1, 2]]
        });

        t.equal(f(0, {foo: 1}), 2);

        t.end();
    });

    t.test('property function, missing property', (t) => {
        const f = createInterpolated({
            property: 'foo',
            type: 'exponential',
            stops: [[0, 0], [1, 2]]
        });

        t.equal(f(0, {}), 2);

        t.end();
    });

    t.test('zoom-and-property function, one stop', (t) => {
        const f = createInterpolated({
            type: 'exponential',
            property: 'prop',
            stops: [[{ zoom: 1, value: 1 }, 2]]
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
        const f = createInterpolated({
            type: 'exponential',
            property: 'prop',
            base: 1,
            stops: [
                [{ zoom: 1, value: 0 }, 0],
                [{ zoom: 1, value: 2 }, 4],
                [{ zoom: 3, value: 0 }, 0],
                [{ zoom: 3, value: 2 }, 12]]
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
        const f = createInterpolated({
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
        });

        t.equal(f(0, { prop: 1 }), 2);
        t.equal(f(1, { prop: 1 }), 2);
        t.equal(f(2, { prop: 1 }), 4);

        t.end();
    });

    t.test('zoom-and-property function, two stops, fractional zoom', (t) => {
        const f = createInterpolated({
            type: 'exponential',
            property: 'prop',
            base: 1,
            stops: [
                [{ zoom: 1.9, value: 0 }, 4],
                [{ zoom: 2.1, value: 0 }, 8]
            ]
        });

        t.equal(f(1.9, { prop: 1 }), 4);
        t.equal(f(2, { prop: 1 }), 6);
        t.equal(f(2.1, { prop: 1 }), 8);

        t.end();
    });

    t.end();
});

test('interval function', (t) => {
    t.test('is the default for piecewise-constant properties', (t) => {
        const f = createInterval({
            stops: [[-1, 11], [0, 111]]
        });

        t.equal(f(-1.5), 11);
        t.equal(f(-0.5), 11);
        t.equal(f(0), 111);
        t.equal(f(0.5), 111);

        t.end();
    });

    t.test('one stop', (t) => {
        const f = createInterpolated({
            type: 'interval',
            stops: [[0, 11]]
        });

        t.equal(f(-0.5), 11);
        t.equal(f(0), 11);
        t.equal(f(0.5), 11);

        t.end();
    });

    t.test('two stops', (t) => {
        const f = createInterpolated({
            type: 'interval',
            stops: [[-1, 11], [0, 111]]
        });

        t.equal(f(-1.5), 11);
        t.equal(f(-0.5), 11);
        t.equal(f(0), 111);
        t.equal(f(0.5), 111);

        t.end();
    });

    t.test('three stops', (t) => {
        const f = createInterpolated({
            type: 'interval',
            stops: [[-1, 11], [0, 111], [1, 1111]]
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
        const f = createInterpolated({
            type: 'interval',
            stops: [[-1, 11], [0, 111], [1, 1111], [2, 11111]]
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

    t.test('property present', (t) => {
        const f = createInterpolated({
            property: 'foo',
            type: 'interval',
            stops: [[0, 'bad'], [1, 'good'], [2, 'bad']]
        });

        t.equal(f(0, {foo: 1.5}), 'good');

        t.end();
    });

    t.test('property absent', (t) => {
        const f = createInterpolated({
            property: 'foo',
            type: 'interval',
            stops: [[0, 'zero'], [1, 'one'], [2, 'two']]
        });

        t.equal(f(0, {}), 'two');

        t.end();
    });

    t.end();
});

test('categorical function', (t) => {
    t.test('property present', (t) => {
        const f = createInterpolated({
            property: 'foo',
            type: 'categorical',
            stops: [[0, 'bad'], [1, 'good'], [2, 'bad']]
        });

        t.equal(f(0, {foo: 1}), 'good');

        t.end();
    });

    t.test('property absent', (t) => {
        const f = createInterpolated({
            property: 'foo',
            type: 'categorical',
            stops: [[0, 'zero'], [1, 'one'], [2, 'two']]
        });

        t.equal(f(0, {}), 'zero');

        t.end();
    });

    t.end();
});

test('identity function', (t) => {
    t.test('property present', (t) => {
        const f = createInterpolated({
            property: 'foo',
            type: 'identity'
        });

        t.equal(f(0, {foo: 1}), 1);

        t.end();
    });

    t.test('property absent', (t) => {
        const f = createInterpolated({
            property: 'foo',
            type: 'identity'
        });

        t.equal(f(0, {}), undefined);

        t.end();
    });

    t.end();
});

test('unknown function', (t) => {
    t.throws(() => createInterpolated({type: 'nonesuch', stops: [[]]}), /Unknown function type "nonesuch"/);
    t.end();
});

test('isConstant', (t) => {
    t.test('constant', (t) => {
        const f = createInterpolated(1);

        t.ok(f.isZoomConstant);
        t.ok(f.isFeatureConstant);

        t.end();
    });

    t.test('zoom', (t) => {
        const f = createInterpolated({
            stops: [[1, 1]]
        });

        t.notOk(f.isZoomConstant);
        t.ok(f.isFeatureConstant);

        t.end();
    });

    t.test('property', (t) => {
        const f = createInterpolated({
            stops: [[1, 1]],
            property: 'mapbox'
        });

        t.ok(f.isZoomConstant);
        t.notOk(f.isFeatureConstant);

        t.end();
    });

    t.test('zoom + property', (t) => {
        const f = createInterpolated({
            stops: [[{ zoom: 1, data: 1 }, 1]],
            property: 'mapbox'
        });

        t.notOk(f.isZoomConstant);
        t.notOk(f.isFeatureConstant);

        t.end();
    });

    t.end();
});
