import {test} from '../util/test';
import fs from 'fs';
import path from 'path';
import reference from '../../src/style-spec/reference/latest';
import {Linter} from 'eslint';
import {scripts} from '../../package.json';

const minBundle = fs.readFileSync('dist/mapbox-gl.js', 'utf8');

test('production build removes asserts', (t) => {
    t.assert(minBundle.indexOf('canary assert') === -1);
    t.assert(minBundle.indexOf('canary debug run') === -1);
    t.end();
});

test('trims package.json assets', (t) => {
    // confirm that the entire package.json isn't present by asserting
    // the absence of each of our script strings
    for (const name in scripts) {
        t.assert(minBundle.indexOf(scripts[name]) === -1);
    }
    t.end();
});

test('trims reference.json fields', (t) => {
    t.assert(reference.$root.version.doc);
    t.assert(minBundle.indexOf(reference.$root.version.doc) === -1);
    t.end();
});

test('can be browserified', (t) => {
    const browserify = require('browserify');
    browserify(path.join(__dirname, 'browserify-test-fixture.js')).bundle((err) => {
        t.ifError(err);
        t.end();
    });
});

test('evaluates without errors', (t) => {
    t.doesNotThrow(() => require(path.join(__dirname, '../../dist/mapbox-gl.js')));
    t.end();
});

test('distributed in plain ES5 code', (t) => {
    const linter = new Linter();
    const messages = linter.verify(minBundle, {
        parserOptions: {
            ecmaVersion: 5
        },
        rules: {},
        env: {
            node: true
        }
    });
    t.deepEqual(messages.map(message => `${message.line}:${message.column}: ${message.message}`), []);
    t.end();
});

