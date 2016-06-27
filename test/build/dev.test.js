'use strict';

var test = require('tap').test;
var fs = require('fs');

test('dev build contains asserts', function(t) {
    t.assert(fs.readFileSync('dist/mapbox-gl-dev.js', 'utf8').indexOf('assert(') !== -1);
    t.end();
});
