'use strict';

var test = require('tap').test;
var LngLat = require('../../../js/geo/lng_lat');
var LngLatBounds = require('../../../js/geo/lng_lat_bounds');

test('LngLatBounds', function(t) {
    t.test('#constructor', function(t) {
        var sw = new LngLat(0, 0);
        var ne = new LngLat(-10, 10);
        var bounds = new LngLatBounds(sw, ne);
        t.equal(bounds.getSouth(), 0);
        t.equal(bounds.getWest(), 0);
        t.equal(bounds.getNorth(), 10);
        t.equal(bounds.getEast(), -10);
        t.end();
    });

    t.test('#constructor across dateline', function(t) {
        var sw = new LngLat(170, 0);
        var ne = new LngLat(-170, 10);
        var bounds = new LngLatBounds(sw, ne);
        t.equal(bounds.getSouth(), 0);
        t.equal(bounds.getWest(), 170);
        t.equal(bounds.getNorth(), 10);
        t.equal(bounds.getEast(), -170);
        t.end();
    });

    t.test('#constructor across pole', function(t) {
        var sw = new LngLat(0, 85);
        var ne = new LngLat(-10, -85);
        var bounds = new LngLatBounds(sw, ne);
        t.equal(bounds.getSouth(), 85);
        t.equal(bounds.getWest(), 0);
        t.equal(bounds.getNorth(), -85);
        t.equal(bounds.getEast(), -10);
        t.end();
    });

    t.test('#constructor no args', function(t) {
        var bounds = new LngLatBounds();
        t.throws(function() {
            bounds.getCenter();
        });
        t.end();
    });

    t.test('#extend with coordinate', function(t) {
        var bounds = new LngLatBounds([0, 0], [10, 10]);
        bounds.extend([-10, -10]);

        t.equal(bounds.getSouth(), -10);
        t.equal(bounds.getWest(), -10);
        t.equal(bounds.getNorth(), 10);
        t.equal(bounds.getEast(), 10);

        t.end();
    });

    t.test('#extend with bounds', function(t) {
        var bounds1 = new LngLatBounds([0, 0], [10, 10]);
        var bounds2 = new LngLatBounds([-10, -10], [10, 10]);
        bounds1.extend(bounds2);

        t.equal(bounds1.getSouth(), -10);
        t.equal(bounds1.getWest(), -10);
        t.equal(bounds1.getNorth(), 10);
        t.equal(bounds1.getEast(), 10);

        t.end();
    });

    t.test('accessors', function(t) {
        var sw = new LngLat(0, 0);
        var ne = new LngLat(-10, -20);
        var bounds = new LngLatBounds(sw, ne);
        t.deepEqual(bounds.getCenter(), new LngLat(-5, -10));
        t.equal(bounds.getSouth(), 0);
        t.equal(bounds.getWest(), 0);
        t.equal(bounds.getNorth(), -20);
        t.equal(bounds.getEast(), -10);
        t.deepEqual(bounds.getSouthWest(), new LngLat(0, 0));
        t.deepEqual(bounds.getSouthEast(), new LngLat(-10, 0));
        t.deepEqual(bounds.getNorthEast(), new LngLat(-10, -20));
        t.deepEqual(bounds.getNorthWest(), new LngLat(0, -20));
        t.end();
    });

    t.test('#convert', function(t) {
        var sw = new LngLat(0, 0);
        var ne = new LngLat(-10, 10);
        var bounds = new LngLatBounds(sw, ne);
        t.equal(LngLatBounds.convert(undefined), undefined);
        t.deepEqual(LngLatBounds.convert(bounds), bounds);
        t.deepEqual(LngLatBounds.convert([sw, ne]), bounds);
        t.deepEqual(LngLatBounds.convert([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]), bounds);
        t.end();
    });

    t.test('#toArray', function(t) {
        var llb = new LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
        t.deepEqual(llb.toArray(), [[-73.9876, 40.7661], [-73.9397, 40.8002]]);
        t.end();
    });

    t.test('#toString', function(t) {
        var llb = new LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
        t.deepEqual(llb.toString(), 'LngLatBounds(LngLat(-73.9876, 40.7661), LngLat(-73.9397, 40.8002))');
        t.end();
    });

    t.end();
});
