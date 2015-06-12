'use strict';

var test = require('tape');
var MapboxGLScale = require('../');

test('constant', function(t) {
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

    t.end();
});

test('domain & range', function(t) {
    t.test('one element', function(t) {
        var scale = MapboxGLScale({
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

test('base', function(t) {
    var scale = MapboxGLScale({
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

test('global / feature attributes', function(t) {

    t.test('global', function(t) {
        var scale = MapboxGLScale({
            domain: [1, 3],
            range: [2, 6],
            property: 'mapbox'
        });

        t.equal(scale({mapbox: 2})({}), 4);

        t.end();
    });

    t.test('feature', function(t) {
        var scale = MapboxGLScale({
            domain: [1, 3],
            range: [2, 6],
            property: 'mapbox'
        });

        t.equal(scale({})({mapbox: 2}), 4);

        t.end();
    });

    t.end();
});

test('property', function(t) {

    t.test('missing property', function(t) {
        var scale = MapboxGLScale({
            domain: [1, 3],
            range: [2, 6],
            property: 'mapbox'
        });

        t.equal(scale({})({}), 2);

        t.end();
    });

    t.test('one property', function(t) {
        var scale = MapboxGLScale({
            domain: [1, 3],
            range: [2, 6],
            property: 'mapbox'
        });

        t.equal(scale({mapbox: 1})({}), 2);
        t.equal(scale({mapbox: 2})({}), 4);
        t.equal(scale({mapbox: 3})({}), 6);

        t.end();
    });

    t.test('two properties', function(t) {
        var scale = MapboxGLScale({
            domain: [1, 3],
            range: [2, 6],
            property: 'mapbox'
        });

        t.equal(scale({mapbox: 1, google: 3})({}), 2);
        t.equal(scale({mapbox: 2, google: 3})({}), 4);
        t.equal(scale({mapbox: 3, google: 0})({}), 6);

        t.end();
    });

    t.end();
});

test('attribute arguments', function(t) {

    t.test('object, object', function(t) {
        var scale = MapboxGLScale({
            domain: [1, 3],
            range: [2, 6],
            property: 'mapbox'
        });

        t.equal(scale({mapbox: 1}, {mapbox: 3})({}), 2);
        t.equal(scale({google: 3}, {mapbox: 1})({}), 2);

        t.end();
    });

});

test('rounding', function(t) {

    t.test('none', function(t) {
        var scale = MapboxGLScale({
            domain: [1, 3],
            range: [2, 6],
            rounding: 'none'
        });

        t.equal(scale({'$zoom': 0})({}), 2);
        t.equal(scale({'$zoom': 1})({}), 2);
        t.equal(scale({'$zoom': 1.9})({}), 1.9 * 2);
        t.equal(scale({'$zoom': 2})({}), 4);
        t.equal(scale({'$zoom': 2.1})({}), 2.1 * 2);
        t.equal(scale({'$zoom': 3})({}), 6);
        t.equal(scale({'$zoom': 4})({}), 6);

        t.end();
    });

    t.test('floor', function(t) {
        var scale = MapboxGLScale({
            domain: [1, 3],
            range: [2, 6],
            rounding: 'floor'
        });

        t.equal(scale({'$zoom': 0})({}), 2);
        t.equal(scale({'$zoom': 1})({}), 2);
        t.equal(scale({'$zoom': 2})({}), 2);
        t.equal(scale({'$zoom': 3})({}), 6);
        t.equal(scale({'$zoom': 4})({}), 6);

        t.end();
    });

    t.end();
});

test('domain types', function(t) {

    t.test('number', function(t) {
        var scale = MapboxGLScale({
            domain: [1, 3],
            range: [2, 6],
            property: 'mapbox'
        });

        t.equal(scale({mapbox: 1})({}), 2);
        t.equal(scale({mapbox: 3})({}), 6);

        t.end();
    });

    t.test('string', function(t) {
        var scale = MapboxGLScale({
            domain: ['a', 'c'],
            range: [2, 6],
            property: 'mapbox'
        });

        t.equal(scale({mapbox: 'a'})({}), 2);
        t.equal(scale({mapbox: 'c'})({}), 6);

        t.end();
    });

    t.test('boolean', function(t) {
        var scale = MapboxGLScale({
            domain: [true, false],
            range: [2, 6],
            property: 'mapbox'
        });

        t.equal(scale({mapbox: true})({}), 2);
        t.equal(scale({mapbox: false})({}), 6);

        t.end();
    });

    t.end();
});
