'use strict';

var test = require('tape');
var MapboxGLScale = require('../');

test('scale types', function(t) {

    t.test('contant', function(t) {

        t.test('range types', function(t) {

            t.test('array', function(t) {
                var scale = MapboxGLScale([1]);

                t.deepEqual(scale({'$zoom': 0})({}), [1]);
                t.deepEqual(scale({'$zoom': 1})({}), [1]);
                t.deepEqual(scale({'$zoom': 2})({}), [1]);

                t.end();
            });

            t.test('number', function(t) {
                var scale = MapboxGLScale(1);

                t.equal(scale({'$zoom': 0})({}), 1);
                t.equal(scale({'$zoom': 1})({}), 1);
                t.equal(scale({'$zoom': 2})({}), 1);

                t.end();
            });

            t.test('string', function(t) {
                var scale = MapboxGLScale('mapbox');

                t.equal(scale({'$zoom': 0})({}), 'mapbox');
                t.equal(scale({'$zoom': 1})({}), 'mapbox');
                t.equal(scale({'$zoom': 2})({}), 'mapbox');

                t.end();
            });

        });

    });

    t.test('interval', function(t) {
        // TODO @nocommit
        t.end();
    });

    t.test('exponential', function(t) {

        t.test('base', function(t) {
            var scale = MapboxGLScale({
                type: 'exponential',
                domain: [1, 3],
                range: [2, 6],
                base: 2
            });

            t.equal(scale({'$zoom': 0})({}), 2);
            t.equal(scale({'$zoom': 1})({}), 2);
            t.equal(scale({'$zoom': 2})({}), 30 / 9);
            t.equal(scale({'$zoom': 3})({}), 6);
            t.equal(scale({'$zoom': 4})({}), 6);

            t.end();
        });

        t.test('domain & range', function(t) {
            t.test('one element', function(t) {
                var scale = MapboxGLScale({
                    type: 'exponential',
                    domain: [1],
                    range: [2]
                });

                t.equal(scale({'$zoom': 0})({}), 2);
                t.equal(scale({'$zoom': 1})({}), 2);
                t.equal(scale({'$zoom': 2})({}), 2);

                t.end();
            });

            t.test('two elements', function(t) {
                var scale = MapboxGLScale({
                    type: 'exponential',
                    domain: [1, 3],
                    range: [2, 6]
                });

                t.equal(scale({'$zoom': 0})({}), 2);
                t.equal(scale({'$zoom': 1})({}), 2);
                t.equal(scale({'$zoom': 2})({}), 4);
                t.equal(scale({'$zoom': 3})({}), 6);
                t.equal(scale({'$zoom': 4})({}), 6);

                t.end();
            });

            t.test('three elements', function(t) {
                var scale = MapboxGLScale({
                    type: 'exponential',
                    domain: [1, 3, 5],
                    range: [2, 6, 10]
                });

                t.equal(scale({'$zoom': 0})({}), 2);
                t.equal(scale({'$zoom': 1})({}), 2);
                t.equal(scale({'$zoom': 2})({}), 4);
                t.equal(scale({'$zoom': 3})({}), 6);
                t.equal(scale({'$zoom': 4})({}), 8);
                t.equal(scale({'$zoom': 5})({}), 10);
                t.equal(scale({'$zoom': 6})({}), 10);

                t.end();
            });

        });

    });

    t.test('categorical', function(t) {

        t.test('one element', function(t) {
            var scale = MapboxGLScale({
                type: 'categorical',
                domain: ['umpteen'],
                range: [42],
                property: 'mapbox'
            });

            t.equal(scale({})({mapbox: 'umpteen'}), 42);
            t.equal(scale({})({mapbox: 'derp'}), 42);

            t.end();
        });

        t.test('two elements', function(t) {
            var scale = MapboxGLScale({
                type: 'categorical',
                domain: ['umpteen', 'eleventy'],
                range: [42, 110],
                property: 'mapbox'
            });

            t.equal(scale({})({mapbox: 'umpteen'}), 42);
            t.equal(scale({})({mapbox: 'eleventy'}), 110);
            t.equal(scale({})({mapbox: 'derp'}), 42);


            t.end();
        });

    });

    t.test('interval', function(t) {

        t.test('one domain element', function(t) {
            var scale = MapboxGLScale({
                type: 'interval',
                domain: [0],
                range: [11, 111],
                property: 'mapbox'
            });

            t.equal(scale({})({mapbox: -0.5}), 11);
            t.equal(scale({})({mapbox: 0}), 111);
            t.equal(scale({})({mapbox: 0.5}), 111);

            t.end();
        });

        t.test('two domain elements', function(t) {
            var scale = MapboxGLScale({
                type: 'interval',
                domain: [0, 1],
                range: [11, 111, 1111],
                property: 'mapbox'
            });

            t.equal(scale({})({mapbox: -0.5}), 11);
            t.equal(scale({})({mapbox: 0}), 111);
            t.equal(scale({})({mapbox: 0.5}), 111);
            t.equal(scale({})({mapbox: 1}), 1111);
            t.equal(scale({})({mapbox: 1.5}), 1111);

            t.end();
        });

    });

});

test('property', function(t) {

    t.test('missing property', function(t) {
        var scale = MapboxGLScale({
            type: 'categorical',
            domain: ['map', 'box'],
            range: ['neat', 'swell'],
            property: 'mapbox'
        });

        t.equal(scale({})({}), 'neat');

        t.end();
    });

    t.test('global property', function(t) {
        var scale = MapboxGLScale({
            type: 'categorical',
            domain: ['map', 'box'],
            range: ['neat', 'swell'],
            property: 'mapbox'
        });

        t.equal(scale({})({mapbox: 'box'}), 'swell');

        t.end();
    });

    t.test('feature property', function(t) {
        var scale = MapboxGLScale({
            type: 'categorical',
            domain: ['map', 'box'],
            range: ['neat', 'swell'],
            property: 'mapbox'
        });

        t.equal(scale({})({mapbox: 'box'}), 'swell');

        t.end();
    });

    t.end();
});

test('isConstant', function(t) {

    t.test('constant', function(t) {
        var scale = MapboxGLScale(1);

        t.ok(scale.isConstant);
        t.ok(scale({}).isConstant);

        t.ok(scale.isGlobalConstant);
        t.ok(scale({}).isGlobalConstant);

        t.ok(scale.isFeatureConstant);
        t.ok(scale({}).isFeatureConstant);

        t.end();
    });

    t.test('global', function(t) {
        var scale = MapboxGLScale({
            domain: [1],
            range: [1],
            property: '$zoom'
        });

        t.notOk(scale.isConstant);
        t.ok(scale({}).isConstant);

        t.notOk(scale.isGlobalConstant);
        t.notOk(scale({}).isGlobalConstant);

        t.ok(scale.isFeatureConstant);
        t.ok(scale({}).isFeatureConstant);

        t.end();
    });

    t.test('feature', function(t) {
        var scale = MapboxGLScale({
            domain: [1],
            range: [1],
            property: 'mapbox'
        });

        t.notOk(scale.isConstant);
        t.notOk(scale({}).isConstant);

        t.notOk(scale.isGlobalConstant);
        t.notOk(scale({}).isGlobalConstant);

        t.notOk(scale.isFeatureConstant);
        t.notOk(scale({}).isFeatureConstant);

        t.end();
    });

    t.end();

});
