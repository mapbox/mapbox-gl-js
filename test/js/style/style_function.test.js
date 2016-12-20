'use strict';

const test = require('mapbox-gl-js-test').test;
const create = require('../../../js/style/style_function').interpolated;

test('function types', (t) => {

    t.test('constant', (t) => {

        t.test('range types', (t) => {

            t.test('array', (t) => {
                const f = create([1]);

                t.deepEqual(f(0), [1]);
                t.deepEqual(f(1), [1]);
                t.deepEqual(f(2), [1]);

                t.end();
            });

            t.test('number', (t) => {
                const f = create(1);

                t.equal(f(0), 1);
                t.equal(f(1), 1);
                t.equal(f(2), 1);

                t.end();
            });

            t.test('string', (t) => {
                const f = create('mapbox');

                t.equal(f(0), 'mapbox');
                t.equal(f(1), 'mapbox');
                t.equal(f(2), 'mapbox');

                t.end();
            });

            t.end();
        });

        t.end();
    });

    t.test('exponential', (t) => {

        t.test('is the default type for numeric inputs', (t) => {
            const f = create({
                stops: [[1, 2], [3, 6]],
                base: 2
            });

            t.equal(f(2), 30 / 9);

            t.end();
        });

        t.test('base', (t) => {
            const f = create({
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

        t.test('stops', (t) => {
            t.test('one element', (t) => {
                const f = create({
                    type: 'exponential',
                    stops: [[1, 2]]
                });

                t.equal(f(0), 2);
                t.equal(f(1), 2);
                t.equal(f(2), 2);

                t.end();
            });

            t.test('two elements', (t) => {
                const f = create({
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

            t.test('three elements', (t) => {
                const f = create({
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

            t.test('four elements', (t) => {
                const f = create({
                    type: 'exponential',
                    stops: [[1, 2], [3, 6], [5, 10], [7, 14]]
                });

                t.equal(f(0), 2);
                t.equal(f(1), 2);
                t.equal(f(2), 4);
                t.equal(f(2.5), 5);
                t.equal(f(3), 6);
                t.equal(f(4), 8);
                t.equal(f(4.5), 9);
                t.equal(f(5), 10);
                t.equal(f(6), 12);
                t.equal(f(7), 14);
                t.equal(f(8), 14);

                t.end();
            });

            t.test('three elements', (t) => {
                const f = create({
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
                const f = create({
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
                    create({
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
                create(params);
                t.deepEqual(params, paramsCopy);
                t.end();
            });

            t.test('property', (t) => {

                t.test('zoom function', (t) => {
                    const f = create({
                        type: 'exponential',
                        stops: [[0, 0], [1, 2]]
                    });

                    t.equal(f(1), 2);

                    t.end();
                });

                t.test('property function', (t) => {
                    const f = create({
                        property: 'foo',
                        type: 'exponential',
                        stops: [[0, 0], [1, 2]]
                    });

                    t.equal(f(0, {foo: 1}), 2);

                    t.end();
                });

                t.test('property function, missing property', (t) => {
                    const f = create({
                        property: 'foo',
                        type: 'exponential',
                        stops: [[0, 0], [1, 2]]
                    });

                    t.equal(f(0, {}), 2);

                    t.end();
                });

                t.test('zoom-and-property function, one element', (t) => {
                    const f = create({
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

                t.test('zoom-and-property function, two elements', (t) => {
                    const f = create({
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

                t.test('zoom-and-property function, three elements', (t) => {
                    const f = create({
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

                t.test('zoom-and-property function, two elements, fractional zoom', (t) => {
                    const f = create({
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

            t.end();
        });

        t.end();
    });

    t.test('categorical', (t) => {

        t.test('is the default type for string inputs', (t) => {
            const f = create({
                stops: [['umpteen', 42]]
            });

            t.equal(f('umpteen'), 42);

            t.end();
        });

        t.test('one element', (t) => {
            const f = create({
                type: 'categorical',
                stops: [['umpteen', 42]]
            });

            t.equal(f('umpteen'), 42);
            t.equal(f('derp'), 42);

            t.end();
        });

        t.test('two elements', (t) => {
            const f = create({
                type: 'categorical',
                stops: [['umpteen', 42], ['eleventy', 110]]
            });

            t.equal(f('umpteen'), 42);
            t.equal(f('eleventy'), 110);
            t.equal(f('derp'), 42);
            t.equal(f('toString'), 42);

            t.end();
        });

        t.test('property', (t) => {

            t.test('zoom function', (t) => {
                const f = create({
                    type: 'categorical',
                    stops: [[0, 'bad'], [1, 'good'], [2, 'bad']]
                });

                t.equal(f(1), 'good');

                t.end();
            });

            t.test('property function', (t) => {
                const f = create({
                    property: 'foo',
                    type: 'categorical',
                    stops: [[0, 'bad'], [1, 'good'], [2, 'bad']]
                });

                t.equal(f(0, {foo: 1}), 'good');

                t.end();
            });

            t.test('property function, missing property', (t) => {
                const f = create({
                    property: 'foo',
                    type: 'categorical',
                    stops: [[0, 'zero'], [1, 'one'], [2, 'two']]
                });

                t.equal(f(0, {}), 'zero');

                t.end();
            });

            t.end();
        });

        t.end();
    });

    t.test('interval', (t) => {

        t.test('one domain elements', (t) => {
            const f = create({
                type: 'interval',
                stops: [[0, 11]]
            });

            t.equal(f(-0.5), 11);
            t.equal(f(0), 11);
            t.equal(f(0.5), 11);

            t.end();
        });

        t.test('two domain elements', (t) => {
            const f = create({
                type: 'interval',
                stops: [[-1, 11], [0, 111]]
            });

            t.equal(f(-1.5), 11);
            t.equal(f(-0.5), 11);
            t.equal(f(0), 111);
            t.equal(f(0.5), 111);

            t.end();
        });

        t.test('three domain elements', (t) => {
            const f = create({
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

        t.test('four domain elements', (t) => {
            const f = create({
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

        t.test('property', (t) => {

            t.test('zoom function', (t) => {
                const f = create({
                    type: 'interval',
                    stops: [[0, 'bad'], [1, 'good'], [2, 'bad']]
                });

                t.equal(f(1.5), 'good');

                t.end();
            });

            t.test('property function', (t) => {
                const f = create({
                    property: 'foo',
                    type: 'interval',
                    stops: [[0, 'bad'], [1, 'good'], [2, 'bad']]
                });

                t.equal(f(0, {foo: 1.5}), 'good');

                t.end();
            });

            t.test('property function, missing property', (t) => {
                const f = create({
                    property: 'foo',
                    type: 'interval',
                    stops: [[0, 'zero'], [1, 'one'], [2, 'two']]
                });

                t.equal(f(0, {}), 'two');

                t.end();
            });

            t.end();
        });

        t.end();
    });

    t.end();
});

test('isConstant', (t) => {

    t.test('constant', (t) => {
        const f = create(1);

        t.ok(f.isZoomConstant);
        t.ok(f.isFeatureConstant);

        t.end();
    });

    t.test('zoom', (t) => {
        const f = create({
            stops: [[1, 1]]
        });

        t.notOk(f.isZoomConstant);
        t.ok(f.isFeatureConstant);

        t.end();
    });

    t.test('feature', (t) => {
        const f = create({
            stops: [[1, 1]],
            property: 'mapbox'
        });

        t.ok(f.isZoomConstant);
        t.notOk(f.isFeatureConstant);

        t.end();
    });

    t.test('zoom + feature', (t) => {
        const f = create({
            stops: [[{ zoom: 1, data: 1 }, 1]],
            property: 'mapbox'
        });

        t.notOk(f.isZoomConstant);
        t.notOk(f.isFeatureConstant);

        t.end();
    });

    t.test('identity', (t) => {

        t.test('array', (t) => {
            const f = create({type: 'identity'});

            t.deepEqual(f([]), []);
            t.deepEqual(f([1]), [1]);
            t.deepEqual(f([1, 2]), [1, 2]);

            t.end();
        });

        t.test('number', (t) => {
            const f = create({type: 'identity'});

            t.equal(f(0), 0);
            t.equal(f(1), 1);
            t.equal(f(2), 2);

            t.end();
        });

        t.test('string', (t) => {
            const f = create({type: 'identity'});

            t.equal(f(''), '');
            t.equal(f('0'), '0');
            t.equal(f('mapbox'), 'mapbox');

            t.end();
        });

        t.end();
    });

    t.end();

});
