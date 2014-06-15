'use strict';
var t = require('tape');
var validate = require('../lib/validate').v2;

t('v3 style', function(t) {
    var validate = require('../lib/validate').v3;
    t.deepEqual(validate.class_fill('foobar', ''), [{
        message: 'class_fill property unrecognized: foobar',
        line: undefined
    }]);
    t.deepEqual(validate.class_fill('fill-opacity', 'foo'), [{
        message: 'fill-opacity: number expected, string found',
        line: undefined
    }]);
    t.deepEqual(validate.class_fill('fill-color', '#ff00ff'), []);
    t.deepEqual(validate.class_fill('fill-color', 'red'), []);
    t.deepEqual(validate.class_line('line-width', {
          "fn": "exponential",
          "z": 9,
          "val": 1,
          "slope": 0.21,
          "min": 4
        }), []);
    t.deepEqual(validate.class_line('line-width', {
          "fn": "expinential"
        }).slice(0,1), [ { line: undefined, message: 'line-width.fn: expected one of [stops], expinential found' } ]);
    t.deepEqual(validate.class_fill('fill-color', 're'),
                [ { line: undefined, message: 'fill-color: color expected, re found' } ]);
    t.deepEqual(validate.class_fill('transition-fill-color', {
        duration: 100,
        delay: 50
    }), []);
    t.deepEqual(validate.class_fill('transition-fill-color', {
        duration: "100",
        delay: 50
    }),
     [ { line: undefined, message: 'transition-fill-color.duration: number expected, string found' } ]);
    // TODO where did this go
    /*
    t.deepEqual(validate.style('point-alignment', 'screen'), []);
    t.deepEqual(validate.style('point-alignment', 'scree'), [
        {
            line: undefined,
            message: 'point-alignment: expected one of [screen, line], scree found'
        }
    ]);
    */
    t.end();
});


t('style validity', function(t) {
    t.deepEqual(validate.style('foobar', ''), [{
        message: 'style property unrecognized: foobar',
        line: undefined
    }]);
    t.deepEqual(validate.style('opacity', 'foo'), [{
        message: 'opacity: number expected, string found',
        line: undefined
    }]);
    t.deepEqual(validate.style('opacity', 0), []);
    t.deepEqual(validate.style('hidden', true), []);
    t.deepEqual(validate.style('fill-color', '#ff00ff'), []);
    t.deepEqual(validate.style('fill-color', 'red'), []);
    t.deepEqual(validate.style('line-width', {
          "fn": "exponential",
          "z": 9,
          "val": 1,
          "slope": 0.21,
          "min": 4
        }), []);
    t.deepEqual(validate.style('line-width', {
          "fn": "expinential",
          "z": 9,
          "val": 1,
          "slope": 0.21,
          "min": 4
        }), [ { line: undefined, message: 'line-width.fn: expected one of [stops, linear, exponential], expinential found' } ]);
    t.deepEqual(validate.style('fill-color', 're'),
                [ { line: undefined, message: 'fill-color: color expected, re found' } ]);
    t.deepEqual(validate.style('point-alignment', 'screen'), []);
    t.deepEqual(validate.style('transition-fill-color', {
        duration: 100,
        delay: 50
    }), []);
    t.deepEqual(validate.style('transition-fill-color', {
        duration: "100",
        delay: 50
    }),
     [ { line: undefined, message: 'transition-fill-color.duration: number expected, string found' } ]);
    t.deepEqual(validate.style('point-alignment', 'scree'), [
        {
            line: undefined,
            message: 'point-alignment: expected one of [screen, line], scree found'
        }
    ]);
    t.end();
});

t('style validity', function(t) {
    t.deepEqual(validate.bucket('filter',
        {"source": "mapbox.mapbox-terrain-v1,mapbox.mapbox-streets-v5", "layer": "landcover", "class": "snow"}),
        []);
    t.end();
});

