'use strict';

var test = require('prova');
var Map = require('../../../js/ui/map');
var Style = require('../../../js/style/style');

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
            interactive: false,
            attributionControl: false
        });
    }

    t.test('constructor', function(t) {
        var map = createMap();
        t.ok(map.getContainer());
        t.end();
    });

    t.test('#setStyle', function(t) {
        t.test('returns self', function(t) {
            var map = createMap(),
                style = {
                    version: 7,
                    sources: {},
                    layers: []
                };
            t.equal(map.setStyle(style), map);
            t.end();
        });

        t.test('sets up event forwarding', function(t) {
            var map = createMap(),
                style = new Style({
                    version: 7,
                    sources: {},
                    layers: []
                });

            function styleEvent(e) {
                t.equal(e.style, style);
            }

            function sourceEvent(e) {
                t.equal(e.style, style);
            }

            function tileEvent(e) {
                t.equal(e.style, style);
            }

            map.on('style.load',    styleEvent);
            map.on('style.error',   styleEvent);
            map.on('style.change',  styleEvent);
            map.on('source.load',   sourceEvent);
            map.on('source.error',  sourceEvent);
            map.on('source.change', sourceEvent);
            map.on('tile.add',      tileEvent);
            map.on('tile.load',     tileEvent);
            map.on('tile.error',    tileEvent);
            map.on('tile.remove',   tileEvent);

            t.plan(10);
            map.setStyle(style); // Fires load
            style.fire('error');
            style.fire('change');
            style.fire('source.load');
            style.fire('source.error');
            style.fire('source.change');
            style.fire('tile.add');
            style.fire('tile.load');
            style.fire('tile.error');
            style.fire('tile.remove');
        });

        t.test('can be called more than once', function(t) {
            var map = createMap();

            map.setStyle({version: 7, sources: {}, layers: []});
            map.setStyle({version: 7, sources: {}, layers: []});

            t.end();
        });
    });

    t.test('#getBounds', function(t) {
        var map = createMap();
        t.deepEqual(parseFloat(map.getBounds().getCenter().lat.toFixed(10)), 0, 'getBounds');
        t.deepEqual(parseFloat(map.getBounds().getCenter().lng.toFixed(10)), 0, 'getBounds');
        t.end();
    });

    t.test('#jumpTo', function(t) {
        var map = createMap();

        t.test('sets center', function(t) {
            map.jumpTo({center: [1, 2]});
            t.deepEqual(map.getCenter(), { lat: 1, lng: 2 });
            t.end();
        });

        t.test('keeps current center if not specified', function(t) {
            map.jumpTo({});
            t.deepEqual(map.getCenter(), { lat: 1, lng: 2 });
            t.end();
        });

        t.test('sets zoom', function(t) {
            map.jumpTo({zoom: 3});
            t.deepEqual(map.getZoom(), 3);
            t.end();
        });

        t.test('keeps current zoom if not specified', function(t) {
            map.jumpTo({});
            t.deepEqual(map.getZoom(), 3);
            t.end();
        });

        t.test('sets bearing', function(t) {
            map.jumpTo({bearing: 4});
            t.deepEqual(map.getBearing(), 4);
            t.end();
        });

        t.test('keeps current bearing if not specified', function(t) {
            map.jumpTo({});
            t.deepEqual(map.getBearing(), 4);
            t.end();
        });

        t.test('sets pitch', function(t) {
            map.jumpTo({pitch: 45});
            t.deepEqual(map.getPitch(), 45);
            t.end();
        });

        t.test('keeps current pitch if not specified', function(t) {
            map.jumpTo({});
            t.deepEqual(map.getPitch(), 45);
            t.end();
        });

        t.test('sets multiple properties', function(t) {
            map.jumpTo({
                center: [1, 2],
                zoom: 3,
                bearing: 180,
                pitch: 45
            });
            t.deepEqual(map.getCenter(), { lat: 1, lng: 2 });
            t.deepEqual(map.getZoom(), 3);
            t.deepEqual(map.getBearing(), 180);
            t.deepEqual(map.getPitch(), 45);
            t.end();
        });

        t.test('emits move events', function(t) {
            var started, ended;
            map.on('movestart', function() { started = true; })
                .on('moveend', function() { ended = true; });
            map.jumpTo({center: [1, 2]});
            t.ok(started);
            t.ok(ended);
            t.end();
        });

        t.test('cancels in-progress easing', function(t) {
            map.panTo([3, 4]);
            t.ok(map.isEasing());
            map.jumpTo({center: [1, 2]});
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

    t.test('#addClass', function(t) {
        var map = createMap();
        map.addClass('night');
        t.ok(map.hasClass('night'));
        t.end();
    });

    t.test('#removeClass', function(t) {
        var map = createMap();
        map.addClass('night');
        map.removeClass('night');
        t.ok(!map.hasClass('night'));
        t.end();
    });

    t.test('#setClasses', function(t) {
        var map = createMap();
        map.addClass('night');
        map.setClasses([]);
        t.ok(!map.hasClass('night'));

        map.setClasses(['night']);
        t.ok(map.hasClass('night'));
        t.end();
    });

    t.test('#getClasses', function(t) {
        var map = createMap();
        map.addClass('night');
        t.deepEqual(map.getClasses(), ['night']);
        t.end();
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
