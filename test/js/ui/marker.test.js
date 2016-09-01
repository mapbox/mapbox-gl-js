'use strict';

var test = require('tap').test;
var window = require('../../../js/util/window');
var Map = require('../../../js/ui/map');
var Marker = require('../../../js/ui/marker');
var Popup = require('../../../js/ui/popup');

function createMap() {
    var container = window.document.createElement('div');
    container.offsetWidth = 512;
    container.offsetHeight = 512;
    return new Map({container: container});
}

test('Marker', function (t) {
    t.test('constructor', function (t) {
        var el = window.document.createElement('div');
        var marker = new Marker(el);
        t.ok(marker.getElement(), 'marker element is created');
        t.end();
    });

    t.test('marker is added to map', function (t) {
        var map = createMap();
        var marker = new Marker(window.document.createElement('div')).setLngLat([-77.01866, 38.888]);
        t.ok(marker.addTo(map) instanceof Marker, 'marker.addTo(map) returns Marker instance');
        t.ok(marker._map, 'marker instance is bound to map instance');
        t.end();
    });

    t.test('popups can be bound to marker instance', function (t) {
        var map = createMap();
        var popup = new Popup();
        var marker = new Marker(window.document.createElement('div')).setLngLat([-77.01866, 38.888]).addTo(map);
        marker.setPopup(popup);
        t.ok(marker.getPopup() instanceof Popup, 'popup created with Popup instance');
        t.end();
    });

    t.test('popups can be unbound from a marker instance', function (t) {
        var map = createMap();
        var marker = new Marker(window.document.createElement('div')).setLngLat([-77.01866, 38.888]).addTo(map);
        marker.setPopup(new Popup());
        t.ok(marker.getPopup() instanceof Popup);
        t.ok(marker.setPopup() instanceof Marker, 'passing no argument to Marker.setPopup() is valid');
        t.ok(!marker.getPopup(), 'Calling setPopup with no argument successfully removes Popup instance from Marker instance');
        t.end();
    });

    t.end();
});
