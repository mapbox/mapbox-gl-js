'use strict';

var test = require('tap').test;
var LngLat = require('../../../js/geo/lng_lat');
var LngLatBounds = require('../../../js/geo/lng_lat_bounds');

test('LngLatBounds', function(t) {
    t.test('#constructor', function(t) {
        var sw = new LngLat(0, 0);
        var ne = new LngLat(-10, 10);
        var bounds = new LngLatBounds(sw, ne);
        t.ok(bounds instanceof LngLatBounds, 'creates an object');
        t.end();
    });

    t.test('#constructor-noargs', function(t) {
        var bounds = new LngLatBounds();
        t.throws(function() {
            bounds.getCenter();
        });
        t.end();
    });

    t.test('extend', function(t) {
        var sw = new LngLat(0, 0);
        var ne = new LngLat(-10, 10);
        var bounds = new LngLatBounds(sw, ne);
        var outer = new LngLat(-20, 20);
        var largerbounds = new LngLatBounds(sw, outer);
        t.equal(bounds.extend(outer), bounds);
        t.deepEqual(bounds.extend(outer), largerbounds);

        var tinybounds = new LngLatBounds(sw, sw);
        t.equal(tinybounds.extend(largerbounds), tinybounds);
        t.deepEqual(tinybounds, largerbounds);

        tinybounds = new LngLatBounds(sw, sw);
        tinybounds.extend([-10, 10]);
        t.deepEqual(tinybounds.getNorthWest(), new LngLat(-10, 10));

        var emptybounds = new LngLatBounds();
        tinybounds.extend(emptybounds);
        t.deepEqual(tinybounds.getNorthWest(), new LngLat(-10, 10));

        t.end();
    });

    t.test('accessors', function(t) {
        var sw = new LngLat(0, 0);
        var ne = new LngLat(-10, 10);
        var bounds = new LngLatBounds(sw, ne);
        t.deepEqual(bounds.getCenter(), new LngLat(-5, 5));
        t.equal(bounds.getWest(), -10);
        t.equal(bounds.getEast(), 0);
        t.equal(bounds.getNorth(), 10);
        t.equal(bounds.getSouth(), 0);
        t.deepEqual(bounds.getSouthWest(), new LngLat(-10, 0));
        t.deepEqual(bounds.getSouthEast(), new LngLat(0, 0));
        t.deepEqual(bounds.getNorthEast(), new LngLat(0, 10));
        t.deepEqual(bounds.getNorthWest(), new LngLat(-10, 10));
        t.end();
    });

    t.test('.convert', function(t) {
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
