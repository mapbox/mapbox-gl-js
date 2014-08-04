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

    t.test('constructor', function(t) {
        var map = createMap();
        t.ok(map.canvas);
        t.end();
    });

    t.test('#setView', function(t) {
        var map = createMap();

        t.test('sets center', function(t) {
            map.setView([1, 2], 3, 4);
            t.deepEqual(map.getCenter(), { lat: 1, lng: 2 });
            t.end();
        });

        t.test('sets zoom', function(t) {
            map.setView([1, 2], 3, 4);
            t.deepEqual(map.getZoom(), 3);
            t.end();
        });

        t.test('sets bearing', function(t) {
            map.setView([1, 2], 3, 4);
            t.deepEqual(map.getBearing(), 4);
            t.end();
        });

        t.test('emits move events', function(t) {
            var started, ended;
            map.on('movestart', function() { started = true; })
                .on('moveend', function() { ended = true; });
            map.setView([1, 2], 3, 4);
            t.ok(started);
            t.ok(ended);
            t.end();
        });

        t.test('cancels in-progress easing', function(t) {
            map.panTo([3, 4]);
            t.ok(map.isEasing());
            map.setView([1, 2], 3, 4);
            t.ok(!map.isEasing());
            t.end();
        });

        t.end();
    });

    t.test('#setCenter', function(t) {
        var map = createMap();

        t.test('sets center', function(t) {
            map.setCenter([1, 2]);
            t.deepEqual(map.getCenter(), { lat: 1, lng: 2 });
            t.end();
        });

        t.test('emits move events', function(t) {
            var started, ended;
            map.on('movestart', function() { started = true; })
                .on('moveend', function() { ended = true; });
            map.setCenter([1, 2]);
            t.ok(started);
            t.ok(ended);
            t.end();
        });

        t.test('cancels in-progress easing', function(t) {
            map.panTo([3, 4]);
            t.ok(map.isEasing());
            map.setCenter([1, 2]);
            t.ok(!map.isEasing());
            t.end();
        });
    });

    t.test('#setZoom', function(t) {
        var map = createMap();

        t.test('sets zoom', function(t) {
            map.setZoom(3);
            t.deepEqual(map.getZoom(), 3);
            t.end();
        });

        t.test('emits move events', function(t) {
            var started, ended;
            map.on('movestart', function() { started = true; })
                .on('moveend', function() { ended = true; });
            map.setZoom(3);
            t.ok(started);
            t.ok(ended);
            t.end();
        });

        t.test('cancels in-progress easing', function(t) {
            map.panTo([3, 4]);
            t.ok(map.isEasing());
            map.setZoom(3);
            t.ok(!map.isEasing());
            t.end();
        });
    });

    t.test('#setBearing', function(t) {
        var map = createMap();

        t.test('sets bearing', function(t) {
            map.setBearing(4);
            t.deepEqual(map.getBearing(), 4);
            t.end();
        });

        t.test('emits move events', function(t) {
            var started, ended;
            map.on('movestart', function() { started = true; })
                .on('moveend', function() { ended = true; });
            map.setBearing(4);
            t.ok(started);
            t.ok(ended);
            t.end();
        });

        t.test('cancels in-progress easing', function(t) {
            map.panTo([3, 4]);
            t.ok(map.isEasing());
            map.setBearing(4);
            t.ok(!map.isEasing());
            t.end();
        });
    });

    t.end();
});
