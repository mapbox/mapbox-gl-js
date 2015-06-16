'use strict';

var test = require('tape');
var MapboxGLScale = require('../');

test('constant type', function(t) {
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
});

test('scale isConstant', function(t) {
    t.test('constant', function(t) {
        var scale = MapboxGLScale(1);

        t.equal(scale.isConstant, true);
        t.equal(scale({}).isConstant, true);

        t.end();
    });

    t.test('global', function(t) {
        var scale = MapboxGLScale({
            domain: [1],
            range: [1],
            property: '$zoom'
        });

        t.notOk(scale.isConstant);
        t.equal(scale({}).isConstant, true);

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

        t.end();
    });

    t.end();
});

test('property', function(t) {

    t.test('missing property', function(t) {
        var scale = MapboxGLScale({
            type: 'ordinal',
            domain: ['map', 'box'],
            range: ['neat', 'swell'],
            property: 'mapbox'
        });

        t.equal(scale({})({}), 'neat');

        t.end();
    });

    t.test('global property', function(t) {
        var scale = MapboxGLScale({
            type: 'ordinal',
            domain: ['map', 'box'],
            range: ['neat', 'swell'],
            property: 'mapbox'
        });

        t.equal(scale({})({mapbox: 'box'}), 'swell');

        t.end();
    });

    t.test('feature property', function(t) {
        var scale = MapboxGLScale({
            type: 'ordinal',
            domain: ['map', 'box'],
            range: ['neat', 'swell'],
            property: 'mapbox'
        });

        t.equal(scale({})({mapbox: 'box'}), 'swell');

        t.end();
    });

    t.end();
});

test('ordinal type', function(t) {

    t.test('domain & range', function(t) {

        t.test('one element', function(t) {
            var scale = MapboxGLScale({
                type: 'ordinal',
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
                type: 'ordinal',
                domain: ['umpteen', 'eleventy'],
                range: [42, 110],
                property: 'mapbox'
            });

            t.equal(scale({})({mapbox: 'umpteen'}), 42);
            t.equal(scale({})({mapbox: 'eleventy'}), 110);

            t.end();
        });

        t.test('three elements', function(t) {
            var scale = MapboxGLScale({
                type: 'ordinal',
                domain: ['umpteen', 'eleventy', 'bunch'],
                range: [42, 110, 17],
                property: 'mapbox'
            });

            t.equal(scale({})({mapbox: 'umpteen'}), 42);
            t.equal(scale({})({mapbox: 'eleventy'}), 110);
            t.equal(scale({})({mapbox: 'bunch'}), 17);

            t.end();
        });

    });

    t.test('range types', function(t) {

        t.test('number', function(t) {
            var scale = MapboxGLScale({
                type: 'ordinal',
                domain: [1, 3],
                range: [2, 6],
                property: 'mapbox'
            });

            t.equal(scale({})({mapbox: 1}), 2);
            t.equal(scale({})({mapbox: 3}), 6);

            t.end();
        });

        t.test('string', function(t) {
            var scale = MapboxGLScale({
                type: 'ordinal',
                domain: [1, 3],
                range: ['a', 'c'],
                property: 'mapbox'
            });

            t.equal(scale({})({mapbox: 1}), 'a');
            t.equal(scale({})({mapbox: 3}), 'c');

            t.end();
        });

        t.test('boolean', function(t) {
            var scale = MapboxGLScale({
                type: 'ordinal',
                domain: [1, 3],
                range: [true, false],
                property: 'mapbox'
            });

            t.equal(scale({})({mapbox: 1}), true);
            t.equal(scale({})({mapbox: 3}), false);

            t.end();
        });

        t.end();
    });

    t.test('domain types', function(t) {

        t.test('number', function(t) {
            var scale = MapboxGLScale({
                type: 'ordinal',
                domain: [1, 3],
                range: [2, 6],
                property: 'mapbox'
            });

            t.equal(scale({})({mapbox: 1}), 2);
            t.equal(scale({})({mapbox: 3}), 6);

            t.end();
        });

        t.test('string', function(t) {
            var scale = MapboxGLScale({
                type: 'ordinal',
                domain: ['a', 'c'],
                range: [2, 6],
                property: 'mapbox'
            });

            t.equal(scale({})({mapbox: 'a'}), 2);
            t.equal(scale({})({mapbox: 'c'}), 6);

            t.end();
        });

        t.test('boolean', function(t) {
            var scale = MapboxGLScale({
                type: 'ordinal',
                domain: [true, false],
                range: [2, 6],
                property: 'mapbox'
            });

            t.equal(scale({})({mapbox: true}), 2);
            t.equal(scale({})({mapbox: false}), 6);

            t.end();
        });

        t.end();
    });


});

test('power type', function(t) {

    t.test('base', function(t) {
        var scale = MapboxGLScale({
            type: 'power',
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
                type: 'power',
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
                type: 'power',
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
                type: 'power',
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

    t.test('range types', function(t) {

        t.test('number', function(t) {
            var scale = MapboxGLScale({
                type: 'power',
                domain: [1, 3],
                range: [2, 6],
                property: 'mapbox'
            });

            t.equal(scale({})({mapbox: 1}), 2);
            t.equal(scale({})({mapbox: 3}), 6);

            t.end();
        });

        t.test('string', function(t) {
            var scale = MapboxGLScale({
                type: 'power',
                domain: [1, 3],
                range: ['a', 'c'],
                rounding: 'floor',
                property: 'mapbox'
            });

            t.equal(scale({})({mapbox: 1}), 'a');
            t.equal(scale({})({mapbox: 3}), 'c');

            t.end();
        });

        t.test('boolean', function(t) {
            var scale = MapboxGLScale({
                type: 'power',
                domain: [1, 3],
                range: [true, false],
                rounding: 'floor',
                property: 'mapbox'
            });

            t.equal(scale({})({mapbox: 1}), true);
            t.equal(scale({})({mapbox: 3}), false);

            t.end();
        });

        t.end();
    });

});
