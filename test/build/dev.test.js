import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('dev build contains asserts', () => {
    assert(fs.readFileSync('dist/mapbox-gl-dev.js', 'utf8').indexOf('canary assert') !== -1);
    assert(fs.readFileSync('dist/mapbox-gl-dev.js', 'utf8').indexOf('canary debug run') !== -1);
});
