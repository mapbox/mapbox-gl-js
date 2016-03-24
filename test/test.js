'use strict';

var test = require('tape');
var MapboxGLFunction = require('../').interpolated;

test('function types', function(t) {

    t.test('contant', function(t) {

        t.test('range types', function(t) {

            t.test('array', function(t) {
                var f = MapboxGLFunction([1]);

                t.deepEqual(f(0), [1]);
                t.deepEqual(f(1), [1]);
                t.deepEqual(f(2), [1]);

                t.end();
            });

            t.test('number', function(t) {
                var f = MapboxGLFunction(1);

                t.equal(f(0), 1);
                t.equal(f(1), 1);
                t.equal(f(2), 1);

                t.end();
            });

            t.test('string', function(t) {
                var f = MapboxGLFunction('mapbox');

                t.equal(f(0), 'mapbox');
                t.equal(f(1), 'mapbox');
                t.equal(f(2), 'mapbox');

                t.end();
            });

        });

    });

    t.test('exponential', function(t) {

        t.test('base', function(t) {
            var f = MapboxGLFunction({
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

        t.test('stops', function(t) {
            t.test('one element', function(t) {
                var f = MapboxGLFunction({
                    type: 'exponential',
                    stops: [[1, 2]]
                });

                t.equal(f(0), 2);
                t.equal(f(1), 2);
                t.equal(f(2), 2);

                t.end();
            });

            t.test('two elements', function(t) {
                var f = MapboxGLFunction({
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

            t.test('three elements', function(t) {
                var f = MapboxGLFunction({
                    type: 'exponential',
                    stops: [[1, 2], [3, 6], [5, 10]]
                });

                t.equal(f(0), 2);
                t.equal(f(1), 2);
                t.equal(f(2), 4);
                t.equal(f(3), 6);
                t.equal(f(4), 8);
                t.equal(f(5), 10);
                t.equal(f(6), 10);

                t.end();
            });

        });

    });

    t.test('categorical', function(t) {

        t.test('one element', function(t) {
            var f = MapboxGLFunction({
                type: 'categorical',
                stops: [['umpteen', 42]]
            });

            t.equal(f('umpteen'), 42);
            t.equal(f('derp'), 42);

            t.end();
        });

        t.test('two elements', function(t) {
            var f = MapboxGLFunction({
                type: 'categorical',
                stops: [['umpteen', 42], ['eleventy', 110]]
            });

            t.equal(f('umpteen'), 42);
            t.equal(f('eleventy'), 110);
            t.equal(f('derp'), 42);

            t.end();
        });

    });

    t.test('interval', function(t) {

        t.test('one domain elements', function(t) {
            var f = MapboxGLFunction({
                type: 'interval',
                stops: [[0, 11]]
            });

            t.equal(f(-0.5), 11);
            t.equal(f(0), 11);
            t.equal(f(0.5), 11);

            t.end();
        });

        t.test('two domain elements', function(t) {
            var f = MapboxGLFunction({
                type: 'interval',
                stops: [[-1, 11], [0, 111]]
            });

            t.equal(f(-1.5), 11);
            t.equal(f(-0.5), 11);
            t.equal(f(0), 111);
            t.equal(f(0.5), 111);

            t.end();
        });

        t.test('three domain elements', function(t) {
            var f = MapboxGLFunction({
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

    });

});

test('property', function(t) {

    t.test('missing property', function(t) {
        var f = MapboxGLFunction({
            type: 'categorical',
            stops: [['map', 'neat'], ['box', 'swell']]
        });

        t.equal(f('box'), 'swell');

        t.end();
    });

    t.test('$zoom', function(t) {
        var f = MapboxGLFunction({
            type: 'categorical',
            stops: [['map', 'neat'], ['box', 'swell']],
            property: '$zoom'
        });

        t.equal(f('box'), 'swell');

        t.end();
    });

    t.test('feature property', function(t) {
        var f = MapboxGLFunction({
            type: 'categorical',
            stops: [['map', 'neat'], ['box', 'swell']],
            property: 'mapbox'
        });

        t.equal(f({}, {mapbox: 'box'}), 'swell');

        t.end();
    });

    t.end();
});

test('isConstant', function(t) {

    t.test('constant', function(t) {
        var f = MapboxGLFunction(1);

        t.ok(f.isGlobalConstant);
        t.ok(f.isFeatureConstant);

        t.end();
    });

    t.test('zoom', function(t) {
        var f = MapboxGLFunction({
            stops: [[1, 1]],
            property: '$zoom'
        });

        t.notOk(f.isGlobalConstant);
        t.ok(f.isFeatureConstant);

        t.end();
    });

    t.test('feature', function(t) {
        var f = MapboxGLFunction({
            stops: [[1, 1]],
            property: 'mapbox'
        });

        t.notOk(f.isGlobalConstant);
        t.notOk(f.isFeatureConstant);

        t.end();
    });

    t.end();

});
