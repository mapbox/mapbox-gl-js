'use strict';

var test = require('tape');
var MapboxGLScale = require('../');

test('constant', function(t) {
    t.test('array', function(t) {
        var scale = MapboxGLScale([1]);

        t.deepEqual(scale(0), [1]);
        t.deepEqual(scale(1), [1]);
        t.deepEqual(scale(2), [1]);

        t.end();
    });

    t.test('number', function(t) {
        var scale = MapboxGLScale(1);

        t.equal(scale(0), 1);
        t.equal(scale(1), 1);
        t.equal(scale(2), 1);

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

        t.equal(scale(0), 2);
        t.equal(scale(1), 2);
        t.equal(scale(2), 2);

        t.end();
    });

    t.test('two elements', function(t) {
        var scale = MapboxGLScale({
            domain: [1, 3],
            range: [2, 6]
        });

        t.equal(scale(0), 2);
        t.equal(scale(1), 2);
        t.equal(scale(2), 4);
        t.equal(scale(3), 6);
        t.equal(scale(4), 6);

        t.end();
    });

    t.test('three elements', function(t) {
        var scale = MapboxGLScale({
            domain: [1, 3, 5],
            range: [2, 6, 10]
        });

        t.equal(scale(0), 2);
        t.equal(scale(1), 2);
        t.equal(scale(2), 4);
        t.equal(scale(3), 6);
        t.equal(scale(4), 8);
        t.equal(scale(5), 10);
        t.equal(scale(6), 10);

        t.end();
    });

});

test('base', function(t) {
    var scale = MapboxGLScale({
        domain: [1, 3],
        range: [2, 6],
        base: 2
    });

    t.equal(scale(0), 2);
    t.equal(scale(1), 2);
    t.equal(scale(2), 30 / 9);
    t.equal(scale(3), 6);
    t.equal(scale(4), 6);

    t.end();
});

test('property', function(t) {

    t.test('missing property', function(t) {
        var scale = MapboxGLScale({
            domain: [1, 3],
            range: [2, 6],
            property: 'mapbox'
        });

        t.equal(scale({}), 2);

        t.end();
    });

    t.test('one property', function(t) {
        var scale = MapboxGLScale({
            domain: [1, 3],
            range: [2, 6],
            property: 'mapbox'
        });

        t.equal(scale({mapbox: 1}), 2);
        t.equal(scale({mapbox: 2}), 4);
        t.equal(scale({mapbox: 3}), 6);

        t.end();
    });

    t.test('two properties', function(t) {
        var scale = MapboxGLScale({
            domain: [1, 3],
            range: [2, 6],
            property: 'mapbox'
        });

        t.equal(scale({mapbox: 1, google: 3}), 2);
        t.equal(scale({mapbox: 2, google: 3}), 4);
        t.equal(scale({mapbox: 3, google: 0}), 6);

        t.end();
    });

    t.test('$zoom from number', function(t) {
        var scale = MapboxGLScale({
            domain: [1, 3],
            range: [2, 6],
            property: '$zoom'
        });

        t.equal(scale(1), 2);
        t.equal(scale(2), 4);
        t.equal(scale(3), 6);

        t.end();
    });

    t.test('$zoom from object', function(t) {
        var scale = MapboxGLScale({
            domain: [1, 3],
            range: [2, 6],
            property: '$zoom'
        });

        t.equal(scale({'$zoom': 1}), 2);
        t.equal(scale({'$zoom': 2}), 4);
        t.equal(scale({'$zoom': 3}), 6);

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

        t.equal(scale({mapbox: 1}, {mapbox: 3}), 2);
        t.equal(scale({google: 3}, {mapbox: 1}), 2);

        t.end();
    });

    t.test('object, number', function(t) {
        var scale = MapboxGLScale({
            domain: [1, 3],
            range: [2, 6],
            property: 'mapbox'
        });

        t.equal(scale(3, {mapbox: 1}), 2);

        t.end();
    });

    t.test('object, number', function(t) {
        var scale = MapboxGLScale({
            domain: [1, 3],
            range: [2, 6],
            property: 'mapbox'
        });

        t.equal(scale({mapbox: 1}, 3), 2);

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

        t.equal(scale(0), 2);
        t.equal(scale(1), 2);
        t.equal(scale(1.9), 1.9 * 2);
        t.equal(scale(2), 4);
        t.equal(scale(2.1), 2.1 * 2);
        t.equal(scale(3), 6);
        t.equal(scale(4), 6);

        t.end();
    });

    t.test('floor', function(t) {
        var scale = MapboxGLScale({
            domain: [1, 3],
            range: [2, 6],
            rounding: 'floor'
        });

        t.equal(scale(0), 2);
        t.equal(scale(1), 2);
        t.equal(scale(2), 2);
        t.equal(scale(3), 6);
        t.equal(scale(4), 6);

        t.end();
    });

    t.test('ceiling', function(t) {
        var scale = MapboxGLScale({
            domain: [1, 3],
            range: [2, 6],
            rounding: 'ceiling'
        });

        t.equal(scale(0), 2);
        t.equal(scale(1), 2);
        t.equal(scale(2), 6);
        t.equal(scale(3), 6);
        t.equal(scale(4), 6);

        t.end();
    });

    t.end();
});
