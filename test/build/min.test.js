'use strict';

const test = require('mapbox-gl-js-test').test;
const fs = require('fs');
const path = require('path');
const pkg = require('../../package.json');
const reference = require('../../src/style-spec/reference/latest');

const minBundle = fs.readFileSync('dist/mapbox-gl.js', 'utf8');

test('production build removes asserts', (t) => {
    t.assert(minBundle.indexOf('assert(') === -1);
    t.end();
});

test('trims package.json assets', (t) => {
    t.assert(minBundle.indexOf(`module.exports={"version":"${pkg.version}"}`) !== -1);
    t.end();
});

test('trims reference.json fields', (t) => {
    t.assert(reference.$root.version.doc);
    t.assert(minBundle.indexOf(reference.$root.version.doc) === -1);
    t.end();
});

test('does not include outdated reference.json files', (t) => {
    t.assert(minBundle.indexOf('reference/v7.json') === -1);
    t.assert(minBundle.indexOf('reference/v6.json') === -1);
    t.end();
});

test('can be browserified', (t) => {
    const browserify = require('browserify');
    browserify(path.join(__dirname, 'browserify-test-fixture.js')).bundle((err) => {
        t.ifError(err);
        t.end();
    });
});
