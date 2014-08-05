'use strict';
/* global process */

var test = require('tape').test;
var Map = require('../../../js/ui/map.js');

test('Map', function(t) {
    function createMap() {
        return new Map({
            container: process.browser ? document.createElement('div') : null,
            style: {
                version: 4,
                layers: []
            }
        });
    }

    t.test('#panBy', function(t) {
        t.test('pans by specified amount', function(t) {
            var map = createMap();
            map.panBy([100, 0], { duration: 0 });
            t.deepEqual(map.getCenter(), { lat: 0, lng: 70.3125 });
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

        t.test('adds specified offset', function(t) {
            var map = createMap();
            map.panTo([0, 100], { offset: [100, 0], duration: 0 });
            t.deepEqual(map.getCenter(), { lat: 0, lng: 29.6875 });
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
        t.test('zooms around specified offset from center', function(t) {
            var map = createMap();
            map.zoomTo(3.2, { duration: 0 });
            t.equal(map.getZoom(), 3.2);
            t.end();
        });

        t.test('adds specified offset', function(t) {
            var map = createMap();
            map.zoomTo(3, { offset: [100, 0], duration: 0 });
            t.equal(map.getZoom(), 3);
            t.deepEqual(map.getCenter(), { lat: 0, lng: 61.5234375 });
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
    });

    t.test('#rotateTo', function(t) {
        t.test('rotates to specified bearing', function(t) {
            var map = createMap();
            map.rotateTo(90, { duration: 0 });
            t.equal(map.getBearing(), 90);
            t.end();
        });

        t.test('rotates around specified offset from center', function(t) {
            var map = createMap();
            map.rotateTo(90, { offset: [100, 0], duration: 0 });
            t.equal(map.getBearing(), 90);
            t.deepEqual(map.getCenter(), { lat: 57.32652122521708, lng: 70.3125 });
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
    });

    t.end();
});
