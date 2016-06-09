'use strict';

var test = require('tap').test;
var mapboxgl = require('../../../js/mapbox-gl');

test('mapboxgl', function(t) {
    t.test('version', function(t) {
        t.ok(mapboxgl.version);
        t.end();
    });
    t.end();
});
