import {test} from '../util/test';
import mapboxgl from '../../src';

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
