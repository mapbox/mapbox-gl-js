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
