import {test} from '../util/test.js';
import fs from 'fs';
import path from 'path';
import reference from '../../src/style-spec/reference/latest.js';
import {scripts} from '../../package.json';
import browserify from 'browserify';

import {fileURLToPath} from 'url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

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
        if (minBundle.indexOf(scripts[name]) >= 0) {
            t.fail();
            break;
        }
    }
    t.end();
});

test('trims reference.json fields', (t) => {
    t.assert(reference.$root.version.doc);
    t.assert(minBundle.indexOf(reference.$root.version.doc) === -1);
    t.end();
});

test('can be browserified', (t) => {
    browserify(path.join(__dirname, 'browserify-test-fixture.js')).bundle((err) => {
        t.ifError(err);
        t.end();
    });
});

test('evaluates without errors', (t) => {
    t.doesNotThrow(async () => {
        await import(path.join(__dirname, '../../dist/mapbox-gl.js'));
    });
    t.end();
});
