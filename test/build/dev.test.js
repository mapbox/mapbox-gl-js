'use strict';

const test = require('mapbox-gl-js-test').test;
const fs = require('fs');

test('dev build contains asserts', (t) => {
    t.assert(fs.readFileSync('dist/mapbox-gl-dev.js', 'utf8').indexOf('assert(') !== -1);
    t.end();
});
