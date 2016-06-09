'use strict';

var test = require('tap').test;
var fs = require('fs');

test('production build removes asserts', function(t) {
    t.assert(fs.readFileSync('dist/mapbox-gl.js', 'utf8').indexOf('assert(') === -1);
    t.end();
});
