import {test} from '../util/test.js';
import mapboxgl from '../../src/index.js';

test('mapboxgl', (t) => {
    t.test('version', (t) => {
        t.ok(mapboxgl.version);
        t.match(mapboxgl.version, /^3\.[0-9]+\.[0-9]+(-(dev|beta|rc)\.[1-9])?$/);
        t.end();
    });

    t.test('workerCount', (t) => {
        t.ok(typeof mapboxgl.workerCount === 'number');
        t.same(mapboxgl.workerCount, 2); // Test that workerCount defaults to 2
        t.end();
    });
    t.end();
});
