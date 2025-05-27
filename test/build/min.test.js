import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'fs';
import path from 'path';
import browserify from 'browserify';
import {fileURLToPath} from 'url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const reference = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/style-spec/reference/v8.json')).toString());
const {scripts} = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json')).toString());

const minBundle = fs.readFileSync('dist/mapbox-gl.js', 'utf8');

test('production build removes asserts', () => {
    assert(minBundle.indexOf('canary assert') === -1);
    assert(minBundle.indexOf('canary debug run') === -1);
});

test('trims package.json assets', () => {
    // confirm that the entire package.json isn't present by asserting
    // the absence of each of our script strings
    for (const name in scripts) {
        if (minBundle.indexOf(scripts[name]) >= 0) {
            throw new Error(`script "${name}" found in minified bundle`);
        }
    }
});

test('trims reference.json fields', () => {
    assert(reference.$root.version.doc);
    assert(minBundle.indexOf(reference.$root.version.doc) === -1);
});

test('can be browserified', () => {
    browserify(path.join(__dirname, 'browserify-test-fixture.js')).bundle((err) => {
        assert(!err, `Browserify failed: ${err}`);
    });
});

test('evaluates without errors', async () => {
    await import(path.join(__dirname, '../../dist/mapbox-gl.js'));
});
