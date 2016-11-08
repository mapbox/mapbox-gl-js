'use strict';

const test = require('mapbox-gl-js-test').test;
const mapboxgl = require('../../js/mapbox-gl');

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
