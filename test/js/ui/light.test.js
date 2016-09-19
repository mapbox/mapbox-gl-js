'use strict';

var test = require('tap').test;
var Evented = require('../../../js/util/evented');
var window = require('../../../js/util/window');
var Map = require('../../../js/ui/map');
var util = require('../../../js/util/util');

test('light', function(t) {
    function createLight(options, callback) {
        var container = window.document.createElement('div');
        container.offsetWidth = 200;
        container.offsetHeight = 200;

        var map = new Map({
            container: container,
            interactive: false,
            attributionControl: false,
            trackResize: true,
            style: {
                "version": 8,
                "sources": {},
                "layers": []
            },
            light: options || {}
        });

        util.extend(map, Evented);

        map.on('load', callback);

        return map;
    }

    t.test('#getLight', function(t) {
        var light = createLight({
            color: 'red',
            intensity: 0.5,
            direction: [1, 60, 70],
            anchor: 'map'
        }, function() {
            t.test('gets all light options', function(t) {
                var currentLighting = light.getLight();

                t.deepEqual(currentLighting.color, 'red');
                t.deepEqual(currentLighting.intensity, 0.5);
                t.deepEqual(currentLighting.direction, [1, 60, 70]);
                t.deepEqual(currentLighting.anchor, 'map');

                t.end();
            });

            t.end();
        });
    });

    t.test('#setLight', function(t) {
        var lightA = createLight({}, function() {
            t.test('sets default options with no initialization arguments', function(t) {
                var currentLighting = lightA.getLight();

                t.deepEqual(currentLighting.color, 'white');
                t.deepEqual(currentLighting.intensity, 0.5);
                t.deepEqual(currentLighting.direction, [1.15, 210, 30]);
                t.deepEqual(currentLighting.anchor, 'viewport');

                t.end();
            });
        });

        var lightB = createLight({}, function() {
            t.test('sets anchor', function(t) {
                lightB.on('lightend', function() {
                    t.deepEqual(lightB.getLightProperty('anchor'), 'map');
                    t.end();

                    lightB.off('lightend');
                });

                lightB.setLight({ anchor: 'map' });
            });
        });

        var lightC = createLight({}, function() {
            t.test('sets color', function(t) {
                lightC.on('lightend', function() {
                    t.deepEqual(lightC.getLightProperty('color'), '#badbad');
                    t.end();

                    lightC.off('lightend');
                });

                lightC.setLight({ color: '#badbad', animate: false });
            });
        });

        var lightD = createLight({}, function() {
            t.test('sets direction', function(t) {
                lightD.on('lightend', function() {
                    t.deepEqual(lightD.getLightProperty('direction'), [2, 45, 45]);
                    t.end();

                    lightD.off('lightend');
                });

                lightD.setLight({ direction: [2, 45, 45], animate: false });
            });
        });

        var lightE = createLight({}, function() {
            t.test('sets intensity', function(t) {
                lightE.on('lightend', function() {
                    t.deepEqual(lightE.getLightProperty('intensity'), 0.2);
                    t.end();

                    lightE.off('lightend');
                });

                lightE.setLight({ intensity: 0.2, animate: false });
            });
        });

        var lightF = createLight({}, function() {
            t.test('emits light events, preserving eventData', function(t) {
                var started, ended,
                    eventData = { data: 'ok' };

                lightF.on('lightstart', function(d) { started = d.data; })
                    .on('lightend', function(d) { ended = d.data; });

                lightF.setLight({ color: '#fabfab', animate: false }, eventData);
                t.equal(started, 'ok');
                t.equal(ended, 'ok');
                t.end();
            });

            t.end();
        });
    });

    t.end();
});
