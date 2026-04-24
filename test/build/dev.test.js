import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('dev build contains asserts', () => {
    assert(fs.readFileSync('dist/mapbox-gl-dev.js', 'utf8').includes('canary assert'));
    assert(fs.readFileSync('dist/mapbox-gl-dev.js', 'utf8').includes('canary debug run'));
});
