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

    t.test('#getLighting', function(t) {
        var light = createLight({
            color: 'red',
            intensity: 0.5,
            direction: [1, 60, 70],
            anchor: 'map'
        }, function() {
            t.test('gets all light options', function(t) {
                var currentLighting = light.getLighting();

                t.deepEqual(currentLighting.color, 'red');
                t.deepEqual(currentLighting.intensity, 0.5);
                t.deepEqual(currentLighting.direction, [1, 60, 70]);
                t.deepEqual(currentLighting.anchor, 'map');

                t.end();
            });

            t.end();
        });
    });

    t.test('#setLighting', function(t) {
        var lightA = createLight({}, function() {
            t.test('sets default options with no initialization arguments', function(t) {
                var currentLighting = lightA.getLighting();

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

                lightB.setLighting({ anchor: 'map' });
            });
        });

        var lightC = createLight({}, function() {
            t.test('sets color', function(t) {
                lightC.on('lightend', function() {
                    t.deepEqual(lightC.getLightProperty('color'), '#badbad');
                    t.end();

                    lightC.off('lightend');
                });

                lightC.setLighting({ color: '#badbad', animate: false });
            });
        });

        var lightD = createLight({}, function() {
            t.test('sets direction', function(t) {
                lightD.on('lightend', function() {
                    t.deepEqual(lightD.getLightProperty('direction'), [2, 45, 45]);
                    t.end();

                    lightD.off('lightend');
                });

                lightD.setLighting({ direction: [2, 45, 45], animate: false });
            });
        });

        var lightE = createLight({}, function() {
            t.test('sets intensity', function(t) {
                lightE.on('lightend', function() {
                    t.deepEqual(lightE.getLightProperty('intensity'), 0.2);
                    t.end();

                    lightE.off('lightend');
                });

                lightE.setLighting({ intensity: 0.2, animate: false });
            });
        });

        var lightF = createLight({}, function() {
            t.test('emits light events, preserving eventData', function(t) {
                var started, ended,
                    eventData = { data: 'ok' };

                lightF.on('lightstart', function(d) { started = d.data; })
                    .on('lightend', function(d) { ended = d.data; });

                lightF.setLighting({ color: '#fabfab', animate: false }, eventData);
                t.equal(started, 'ok');
                t.equal(ended, 'ok');
                t.end();
            });

            t.end();
        });
    });

    t.end();
});
