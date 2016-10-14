'use strict';

const test = require('mapbox-gl-js-test').test;
const window = require('../../../js/util/window');
const Map = require('../../../js/ui/map');
const Marker = require('../../../js/ui/marker');
const Popup = require('../../../js/ui/popup');

function createMap() {
    const container = window.document.createElement('div');
    container.offsetWidth = 512;
    container.offsetHeight = 512;
    return new Map({container: container});
}

test('Marker', (t) => {
    t.test('constructor', (t) => {
        const el = window.document.createElement('div');
        const marker = new Marker(el);
        t.ok(marker.getElement(), 'marker element is created');
        t.end();
    });

    t.test('marker is added to map', (t) => {
        const map = createMap();
        const marker = new Marker(window.document.createElement('div')).setLngLat([-77.01866, 38.888]);
        t.ok(marker.addTo(map) instanceof Marker, 'marker.addTo(map) returns Marker instance');
        t.ok(marker._map, 'marker instance is bound to map instance');
        t.end();
    });

    t.test('marker\'s lngLat can be changed', (t) => {
        const map = createMap();
        const marker = new Marker(window.document.createElement('div')).setLngLat([-77.01866, 38.888]).addTo(map);
        t.ok(marker.setLngLat([-76, 39]) instanceof Marker, 'marker.setLngLat() returns Marker instance');
        const markerLngLat = marker.getLngLat();
        t.ok(markerLngLat.lng === -76 &&  markerLngLat.lat === 39, 'marker\'s position can be updated');
        t.end();
    });

    t.test('popups can be bound to marker instance', (t) => {
        const map = createMap();
        const popup = new Popup();
        const marker = new Marker(window.document.createElement('div')).setLngLat([-77.01866, 38.888]).addTo(map);
        marker.setPopup(popup);
        t.ok(marker.getPopup() instanceof Popup, 'popup created with Popup instance');
        t.end();
    });

    t.test('popups can be unbound from a marker instance', (t) => {
        const map = createMap();
        const marker = new Marker(window.document.createElement('div')).setLngLat([-77.01866, 38.888]).addTo(map);
        marker.setPopup(new Popup());
        t.ok(marker.getPopup() instanceof Popup);
        t.ok(marker.setPopup() instanceof Marker, 'passing no argument to Marker.setPopup() is valid');
        t.ok(!marker.getPopup(), 'Calling setPopup with no argument successfully removes Popup instance from Marker instance');
        t.end();
    });

    t.end();
});
