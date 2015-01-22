'use strict';

var test = require('tape');
var LatLng = require('../../../js/geo/lat_lng');
var LatLngBounds = require('../../../js/geo/lat_lng_bounds');

test('LatLngBounds', function(t) {
    t.test('#constructor', function(t) {
        var sw = new LatLng(0, 0);
        var ne = new LatLng(10, -10);
        var bounds = new LatLngBounds(sw, ne);
        t.ok(bounds instanceof LatLngBounds, 'creates an object');
        t.end();
    });
    t.test('#constructor-noargs', function(t) {
        var bounds = new LatLngBounds();
        t.throws(function() {
            bounds.getCenter();
        });
        t.end();
    });
    t.test('extend', function(t) {
        var sw = new LatLng(0, 0);
        var ne = new LatLng(10, -10);
        var bounds = new LatLngBounds(sw, ne);
        var outer = new LatLng(20, -20);
        var largerbounds = new LatLngBounds(sw, outer);
        t.equal(bounds.extend(outer), bounds);
        t.deepEqual(bounds.extend(outer), largerbounds);

        var tinybounds = new LatLngBounds(sw, sw);
        t.equal(tinybounds.extend(largerbounds), tinybounds);
        t.deepEqual(tinybounds, largerbounds);

        tinybounds = new LatLngBounds(sw, sw);
        tinybounds.extend([10, -10]);
        t.deepEqual(tinybounds.getNorthWest(), new LatLng(10, -10));

        var emptybounds = new LatLngBounds();
        tinybounds.extend(emptybounds);
        t.deepEqual(tinybounds.getNorthWest(), new LatLng(10, -10));

        t.end();
    });
    t.test('accessors', function(t) {
        var sw = new LatLng(0, 0);
        var ne = new LatLng(10, -10);
        var bounds = new LatLngBounds(sw, ne);
        t.deepEqual(bounds.getCenter(), new LatLng(5, -5));
        t.equal(bounds.getWest(), -10);
        t.equal(bounds.getEast(), 0);
        t.equal(bounds.getNorth(), 10);
        t.equal(bounds.getSouth(), 0);
        t.deepEqual(bounds.getSouthWest(), new LatLng(0, -10));
        t.deepEqual(bounds.getSouthEast(), new LatLng(0, 0));
        t.deepEqual(bounds.getNorthEast(), new LatLng(10, 0));
        t.deepEqual(bounds.getNorthWest(), new LatLng(10, -10));
        t.end();
    });
    t.test('.convert', function(t) {
        var sw = new LatLng(0, 0);
        var ne = new LatLng(10, -10);
        var bounds = new LatLngBounds(sw, ne);
        t.equal(LatLngBounds.convert(undefined), undefined);
        t.deepEqual(LatLngBounds.convert(bounds), bounds);
        t.deepEqual(LatLngBounds.convert([sw, ne]), bounds);
        t.end();
    });
});
