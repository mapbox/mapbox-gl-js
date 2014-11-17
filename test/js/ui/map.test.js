'use strict';

var test = require('tape');

require('../../bootstrap');

var Map = require('../../../js/ui/map');
var Source = require('../../../js/source/source');

test('Map', function(t) {
    function createMap() {
        return new Map({
            container: {
                offsetWidth: 200,
                offsetHeight: 200,
                classList: {
                    add: function() {}
                }
            },
            style: {
                version: 6,
                layers: []
            },
            interactive: false,
            attributionControl: false
        });
    }

    t.test('constructor', function(t) {
        var map = createMap();
        t.ok(map.canvas);
        t.end();
    });

    t.test('#getBounds', function(t) {
        var map = createMap();
        t.deepEqual(map.getBounds().getCenter().lat, 0, 'getBounds');
        t.deepEqual(map.getBounds().getCenter().lng, 0, 'getBounds');
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

    t.test('#remove', function(t) {
        var map = createMap();
        t.equal(map.remove(), map);
        t.end();
    });

    t.test('#addControl', function(t) {
        var map = createMap();
        var control = {
            addTo: function(_) {
                t.equal(map, _, 'addTo() called with map');
                t.end();
            }
        };
        map.addControl(control);
    });

    t.test('#addSource', function(t) {
        var map = createMap();
        var source = new Source({
            type: 'vector',
            minzoom: 1,
            maxzoom: 10,
            attribution: 'Mapbox',
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        });
        t.equal(map.addSource('source-id', source), map, 'addSource');
        t.throws(function() {
            map.addSource('source-id', source);
        }, /There is already a source with this ID in the map/, 'addSource - duplicate');
        t.equal(map.removeSource('source-id'), map, 'removeSource');
        t.throws(function() {
            t.equal(map.removeSource('source-id'), map, 'removeSource');
        }, /There is no source with this ID in the map/, 'removeSource - none');
        t.end();
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

    t.test('#project', function(t) {
        var map = createMap();
        t.deepEqual(map.project([0, 0]), { x: 100, y: 100 });
        t.end();
    });

    t.test('#unproject', function(t) {
        var map = createMap();
        t.deepEqual(map.unproject([100, 100]), { lat: 0, lng: 0 });
        t.end();
    });

    t.end();
});
