'use strict';
/* global process */

var test = require('tape').test;
var Map = require('../../../js/ui/map.js');
var util = require('../../../js/util/util.js');

test('Map', function(t) {
    function createMap(options) {
        return new Map(util.extend({
            container: process.browser ? document.createElement('div') : null,
            style: {
                version: 5,
                layers: []
            },
            attributionControl: false
        }, options));
    }

    t.test('#panBy', function(t) {
        t.test('pans by specified amount', function(t) {
            var map = createMap();
            map.panBy([100, 0], { duration: 0 });
            t.deepEqual(map.getCenter(), { lat: 0, lng: 70.3125 });
            t.end();
        });

        t.test('pans relative to viewport on a rotated map', function(t) {
            var map = createMap({bearing: 180});
            map.panBy([100, 0], { duration: 0 });
            t.deepEqual(map.getCenter(), { lat: 0, lng: -70.3125 });
            t.end();
        });

        t.test('emits move events', function(t) {
            var map = createMap();
            var started;

            map.on('movestart', function() {
                started = true;
            });

            map.on('moveend', function() {
                t.ok(started);
                t.end();
            });

            map.panBy([100, 0], { duration: 0 });
        });

        t.test('supresses movestart if noMoveStart option is true', function(t) {
            var map = createMap();
            var started;

            map.on('movestart', function() {
                started = true;
            });

            map.on('moveend', function() {
                t.ok(!started);
                t.end();
            });

            map.panBy([100, 0], { duration: 0, noMoveStart: true });
        });

        t.end();
    });

    t.test('#panTo', function(t) {
        t.test('pans to specified location', function(t) {
            var map = createMap();
            map.panTo([0, 100], { duration: 0 });
            t.deepEqual(map.getCenter(), { lat: 0, lng: 100 });
            t.end();
        });

        t.test('pans with specified offset', function(t) {
            var map = createMap();
            map.panTo([0, 100], { offset: [100, 0], duration: 0 });
            t.deepEqual(map.getCenter(), { lat: 0, lng: 29.6875 });
            t.end();
        });

        t.test('pans with specified offset relative to viewport on a rotated map', function(t) {
            var map = createMap({bearing: 180});
            map.panTo([0, 100], { offset: [100, 0], duration: 0 });
            t.deepEqual(map.getCenter(), { lat: 0, lng: 170.3125 });
            t.end();
        });

        t.test('emits move events', function(t) {
            var map = createMap();
            var started;

            map.on('movestart', function() {
                started = true;
            });

            map.on('moveend', function() {
                t.ok(started);
                t.end();
            });

            map.panTo([0, 100], { duration: 0 });
        });

        t.test('supresses movestart if noMoveStart option is true', function(t) {
            var map = createMap();
            var started;

            map.on('movestart', function() {
                started = true;
            });

            map.on('moveend', function() {
                t.ok(!started);
                t.end();
            });

            map.panTo([0, 100], { duration: 0, noMoveStart: true });
        });

        t.end();
    });

    t.test('#zoomTo', function(t) {
        t.test('zooms to specified level', function(t) {
            var map = createMap();
            map.zoomTo(3.2, { duration: 0 });
            t.equal(map.getZoom(), 3.2);
            t.end();
        });

        t.test('zooms around specified location', function (t) {
            var map = createMap();
            map.zoomTo(3.2, { around: [0, 5], duration: 0 });
            t.equal(map.getZoom(), 3.2);
            t.deepEqual(map.getCenter(), { lat: 0, lng: 4.455905897939886 });
            t.end();
        });

        t.test('zooms with specified offset', function(t) {
            var map = createMap();
            map.zoomTo(3.2, { offset: [100, 0], duration: 0 });
            t.equal(map.getZoom(), 3.2);
            t.deepEqual(map.getCenter(), { lat: 0, lng: 62.66117668978015 });
            t.end();
        });

        t.test('zooms with specified offset relative to viewport on a rotated map', function(t) {
            var map = createMap({bearing: 180});
            map.zoomTo(3.2, { offset: [100, 0], duration: 0 });
            t.equal(map.getZoom(), 3.2);
            t.deepEqual(map.getCenter(), { lat: 0, lng: -62.66117668978012 });
            t.end();
        });

        t.test('emits move events', function(t) {
            var map = createMap();
            var started;

            map.on('movestart', function() {
                started = true;
            });

            map.on('moveend', function() {
                t.ok(started);
                t.end();
            });

            map.zoomTo(3.2, { duration: 0 });
        });

        t.end();
    });

    t.test('#rotateTo', function(t) {
        t.test('rotates to specified bearing', function(t) {
            var map = createMap();
            map.rotateTo(90, { duration: 0 });
            t.equal(map.getBearing(), 90);
            t.end();
        });

        t.test('rotates around specified location', function (t) {
            var map = createMap();
            map.rotateTo(90, { around: [0, 5], duration: 0 });
            t.equal(map.getBearing(), 90);
            t.deepEqual(map.getCenter(), { lat: 4.993665859353271, lng: 4.999999999999972 });
            t.end();
        });

        t.test('rotates with specified offset', function(t) {
            var map = createMap();
            map.rotateTo(90, { offset: [100, 0], duration: 0 });
            t.equal(map.getBearing(), 90);
            t.deepEqual(map.getCenter(), { lat: 57.32652122521708, lng: 70.3125 });
            t.end();
        });

        t.test('rotates with specified offset relative to viewport on a rotated map', function(t) {
            var map = createMap({bearing: 180});
            map.rotateTo(90, { offset: [100, 0], duration: 0 });
            t.equal(map.getBearing(), 90);
            t.deepEqual(map.getCenter(), { lat: 57.32652122521708, lng: -70.31250000000001 });
            t.end();
        });

        t.test('emits move events', function(t) {
            var map = createMap();
            var started;

            map.on('movestart', function() {
                started = true;
            });

            map.on('moveend', function() {
                t.ok(started);
                t.end();
            });

            map.rotateTo(90, { duration: 0 });
        });

        t.end();
    });

    t.test('#easeTo', function(t) {
        t.test('pans to specified location', function(t) {
            var map = createMap();
            map.easeTo([0, 100], undefined, undefined, { duration: 0 });
            t.deepEqual(map.getCenter(), { lat: 0, lng: 100 });
            t.end();
        });

        t.test('zooms to specified level', function(t) {
            var map = createMap();
            map.easeTo(undefined, 3.2, undefined, { duration: 0 });
            t.equal(map.getZoom(), 3.2);
            t.end();
        });

        t.test('rotates to specified bearing', function(t) {
            var map = createMap();
            map.easeTo(undefined, undefined, 90, { duration: 0 });
            t.equal(map.getBearing(), 90);
            t.end();
        });

        t.test('pans and zooms', function(t) {
            var map = createMap();
            map.easeTo([0, 100], 3.2, undefined, { duration: 0 });
            t.deepEqual(map.getCenter(), { lat: 0, lng: 100 });
            t.equal(map.getZoom(), 3.2);
            t.end();
        });

        t.test('pans and rotates', function(t) {
            var map = createMap();
            map.easeTo([0, 100], undefined, 90, { duration: 0 });
            t.deepEqual(map.getCenter(), { lat: 0, lng: 100 });
            t.equal(map.getBearing(), 90);
            t.end();
        });

        t.test('zooms and rotates', function(t) {
            var map = createMap();
            map.easeTo(undefined, 3.2, 90, { duration: 0 });
            t.equal(map.getZoom(), 3.2);
            t.equal(map.getBearing(), 90);
            t.end();
        });

        t.test('pans, zooms, and rotates', function(t) {
            var map = createMap();
            map.easeTo([0, 100], 3.2, 90, { duration: 0 });
            t.deepEqual(map.getCenter(), { lat: 0, lng: 100 });
            t.equal(map.getZoom(), 3.2);
            t.equal(map.getBearing(), 90);
            t.end();
        });

        t.end();
    });

    t.end();
});
