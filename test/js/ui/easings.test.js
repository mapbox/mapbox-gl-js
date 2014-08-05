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
        var map = createMap();

        t.test('pans by specified amount', function(t) {
            map.panBy([100, 0], { duration: 0 });
            t.deepEqual(map.getCenter(), { lat: 0, lng: 70.3125 });
            t.end();
        });

        t.test('emits move events', function(t) {
            var started, ended;
            map.on('movestart', function() { started = true; })
                .on('moveend', function() { ended = true; });
            map.panBy([100, 0], { duration: 0 });
            t.ok(started);
            t.ok(ended);
            t.end();
        });

        t.test('supresses movestart if noMoveStart option is true', function(t) {
            var started, ended;
            map.on('movestart', function() { started = true; })
                .on('moveend', function() { ended = true; });
            map.panBy([100, 0], { duration: 0, noMoveStart: true });
            t.ok(!started);
            t.ok(ended);
            t.end();
        });

        t.end();
    });

    t.test('#panTo', function(t) {
        var map = createMap();

        t.test('pans to specified location', function(t) {
            map.panTo([0, 100], { duration: 0 });
            t.deepEqual(map.getCenter(), { lat: 0, lng: 100 });
            t.end();
        });

        t.test('adds specified offset', function(t) {
            map.panTo([0, 100], { offset: [100, 0], duration: 0 });
            t.deepEqual(map.getCenter(), { lat: 0, lng: 29.6875 });
            t.end();
        });

        t.test('emits move events', function(t) {
            var started, ended;
            map.on('movestart', function() { started = true; })
                .on('moveend', function() { ended = true; });
            map.panTo([0, 100], { duration: 0 });
            t.ok(started);
            t.ok(ended);
            t.end();
        });

        t.test('supresses movestart if noMoveStart option is true', function(t) {
            var started, ended;
            map.on('movestart', function() { started = true; })
                .on('moveend', function() { ended = true; });
            map.panTo([0, 100], { duration: 0, noMoveStart: true });
            t.ok(!started);
            t.ok(ended);
            t.end();
        });

        t.end();
    });

    t.end();
});
