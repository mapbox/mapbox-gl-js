'use strict';

const test = require('tap').test;
const fs = require('fs');
const pkg = require('../../package.json');
const path = require('path');

const minBundle = fs.readFileSync(path.join(__dirname, '../../dist/mapbox-gl.js'), 'utf8');

test('production build removes asserts', (t) => {
    t.assert(minBundle.indexOf('assert(') === -1);
    t.end();
});

test('trims package.json assets', (t) => {
    t.assert(minBundle.indexOf(`.exports={version:"${pkg.version}"}`) !== -1);
    t.end();
});
