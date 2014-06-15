'use strict';
var t = require('tape');
var validate = require('../lib/validate').v3;

// Cover render_fill well as an instance of render_*.
t('v3 render_fill', function(t) {
    t.equal(validate.render_fill('foobar', '')[0].message, 'render_fill property unrecognized: foobar');
    t.equal(validate.render_fill('type', 'line')[0].message, 'type: expected one of [fill], line found');
    t.equal(validate.render_fill('type', 'fill').length, 0);
    t.equal(validate.render_fill('fill-antialias', 1)[0].message, 'fill-antialias: boolean expected, number found');
    t.equal(validate.render_fill('fill-antialias', true).length, 0);

    t.end();
});

// Cover class_fill well as an instance of class_*.
t('v3 class_fill', function(t) {
    t.equal(validate.class_fill('foobar', '')[0].message, 'class_fill property unrecognized: foobar');
    t.equal(validate.class_fill('fill-enabled', 1)[0].message, 'fill-enabled: boolean expected, number found');
    t.equal(validate.class_fill('fill-enabled', true).length, 0);
    t.equal(validate.class_fill('fill-opacity', 'foo')[0].message, 'fill-opacity: number expected, string found');
    t.equal(validate.class_fill('fill-opacity', 1).length, 0);
    t.equal(validate.class_fill('fill-color', 5)[0].message, 'fill-color: color expected, number found');
    t.equal(validate.class_fill('fill-color', [0,0])[0].message, 'fill-color: color expected, 0,0 found');
    t.equal(validate.class_fill('fill-color', [0,0,0]).length, 0);
    t.equal(validate.class_fill('fill-color', [0,0,0,0]).length, 0);
    t.equal(validate.class_fill('fill-color', 'rgb(0,0,0)').length, 0);
    t.equal(validate.class_fill('fill-color', 'rgba(0,0,0,1)').length, 0);
    t.equal(validate.class_fill('fill-color', '#ff00ff').length, 0);
    t.equal(validate.class_fill('fill-color', 'red').length, 0);
    t.equal(validate.class_fill('fill-translate', 1)[0].message, 'fill-translate: array expected, number found');
    t.equal(validate.class_fill('fill-translate', [0,1,2])[0].message, 'fill-translate: array length 2 expected, length 3 found');
    t.equal(validate.class_fill('fill-translate', ['a','b'])[0].message, 'fill-translate[0]: number expected, string found');
    t.equal(validate.class_fill('fill-translate', [0,1]).length, 0);
    t.equal(validate.class_fill('fill-translate-anchor', 1)[0].message, 'fill-translate-anchor: expected one of [map, viewport], 1 found');
    t.equal(validate.class_fill('fill-translate-anchor', 'map').length, 0);

    t.end();
});

t('v3 transition', function(t) {
    t.equal(validate.transition('foobar', '')[0].message, 'transition property unrecognized: foobar');

    // duration in the context of class_fill
    t.equal(validate.class_fill('transition-fill-opacity', {
        foobar: ''
    })[0].message, 'transition property unrecognized: foobar');
    t.equal(validate.class_fill('transition-fill-opacity', {
        duration: ''
    })[0].message, 'transition-fill-opacity.duration: number expected, string found');
    t.equal(validate.class_fill('transition-fill-opacity', {
        delay: ''
    })[0].message, 'transition-fill-opacity.delay: number expected, string found');
    t.equal(validate.class_fill('transition-fill-opacity', {
        duration: 10,
        delay: 10
    }).length, 0);

    t.end();
});

t('v3 function', function(t) {
    t.equal(validate.function('foobar', '')[0].message, 'function property unrecognized: foobar');

    // stops function in the context of class_fill
    t.equal(validate.class_fill('fill-opacity', {
        fn: 'stops'
    })[0].message, 'function property values required');
    t.equal(validate.class_fill('fill-opacity', {
        fn: 'stops',
        values: ''
    })[0].message, 'fill-opacity.values: array expected, string found');
    t.equal(validate.class_fill('fill-opacity', {
        fn: 'stops',
        values: ['a']
    })[0].message, 'fill-opacity.values[0]: array expected, string found');
    t.equal(validate.class_fill('fill-opacity', {
        fn: 'stops',
        values: [[0]]
    })[0].message, 'fill-opacity.values[0]: array length 2 expected, length 1 found');
    t.equal(validate.class_fill('fill-opacity', {
        fn: 'stops',
        values: [[0,1]]
    }).length, 0);

    // linear function in the context of class_fill
    t.equal(validate.class_fill('fill-opacity', {
        fn: 'linear'
    })[2].message, 'function property z required');
    t.equal(validate.class_fill('fill-opacity', {
        fn: 'linear',
        z: 5,
        value: 'boolean'
    }).length, 0);

    // unknown function
    t.equal(validate.class_fill('fill-opacity', {
        fn: 'expinential'
    })[0].message, 'fill-opacity.fn: expected one of [stops], expinential found');

    t.end();
});

t('v3 layer', function(t) {
    t.equal(validate.layer('foobar', '')[0].message, 'layer property unrecognized: foobar');
    t.end();
});

t('v3 source', function(t) {
    t.equal(validate.source('foobar', '')[0].message, 'source property unrecognized: foobar');
    t.end();
});

t('v3 filter', function(t) {
    t.equal(validate.filter('foobar', '')[0].message, 'filter property unrecognized: foobar');
    t.end();
});

