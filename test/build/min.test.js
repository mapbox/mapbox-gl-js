'use strict';

var test = require('tap').test;
var fs = require('fs');
var pkg = require('../../package.json');

var minBundle = fs.readFileSync('dist/mapbox-gl.js', 'utf8');

test('production build removes asserts', function(t) {
    t.assert(minBundle.indexOf('assert(') === -1);
    t.end();
});

test('trims package.json assets', function(t) {
    t.assert(minBundle.indexOf('module.exports={"version":"' + pkg.version + '"}') !== -1);
    t.end();
});
