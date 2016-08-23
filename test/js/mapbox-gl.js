'use strict';

var test = require('tap').test;
var proxyquire = require('proxyquire');
var mapboxgl = require('../../js/mapbox-gl');

test('mapboxgl', function(t) {
    t.test('version', function(t) {
        t.ok(mapboxgl.version);
        t.end();
    });

    t.test('.workerCount defaults to hardwareConcurrency - 1', function (t) {
        var mapboxgl = proxyquire('../../js/mapbox-gl', {
            './util/browser': { hardwareConcurrency: 15 }
        });
        t.equal(mapboxgl.workerCount, 14);
        t.end();
    });
    t.end();
});
