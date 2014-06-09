var t = require('tape'),
    path = require('path'),
    glob = require('glob'),
    fs = require('fs'),
    reference = require('../lib/reference');

t('style validity', function(t) {
    t.deepEqual(reference.validate.style('foobar', ''), [{
        message: 'style property unrecognized: foobar',
        line: undefined
    }]);
    t.deepEqual(reference.validate.style('opacity', 'foo'), [{
        message: 'incorrect property value: number expected, string found',
        line: undefined
    }]);
    t.deepEqual(reference.validate.style('opacity', 0), []);
    t.deepEqual(reference.validate.style('hidden', true), []);
    t.deepEqual(reference.validate.style('fill-color', '#ff00ff'), []);
    t.deepEqual(reference.validate.style('fill-color', 'land', {
        land: 'red'
    }), []);
    t.deepEqual(reference.validate.style('fill-color', 'red'), []);
    t.deepEqual(reference.validate.style('line-width', {
          "fn": "exponential",
          "z": 9,
          "val": 1,
          "slope": 0.21,
          "min": 4
        }), []);
    t.deepEqual(reference.validate.style('line-width', {
          "fn": "expinential",
          "z": 9,
          "val": 1,
          "slope": 0.21,
          "min": 4
        }), [ { line: undefined, message: 'incorrect property value:expinential is not a function type' } ]);
    t.deepEqual(reference.validate.style('fill-color', 're'),
                [ { line: undefined, message: 'incorrect property value: re is not a color' } ]);
    t.deepEqual(reference.validate.style('point-alignment', 'screen'), []);
    t.deepEqual(reference.validate.style('point-alignment', 'scree'), [
        {
            line: undefined,
            message: 'incorrect property value: one of [screen] expected, scree found'
        }
    ]);
    t.end();
});
