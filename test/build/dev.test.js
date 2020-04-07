import {test} from '../util/test';
import fs from 'fs';

test('dev build contains asserts', (t) => {
    t.assert(fs.readFileSync('dist/mapbox-gl-dev.js', 'utf8').indexOf('canary assert') !== -1);
    t.assert(fs.readFileSync('dist/mapbox-gl-dev.js', 'utf8').indexOf('canary debug run') !== -1);
    t.end();
});
