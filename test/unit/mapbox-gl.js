import {test} from '../util/test.js';
import mapboxgl from '../../src/index.js';

test('mapboxgl', (t) => {
    t.test('version', (t) => {
        t.ok(mapboxgl.version);
        t.end();
    });

    t.test('workerCount', (t) => {
        t.ok(typeof mapboxgl.workerCount === 'number');
        t.end();
    });
    t.end();
});
