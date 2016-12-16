'use strict';

const test = require('mapbox-gl-js-test').test;
const window = require('../../../../js/util/window');
const Map = require('../../../../js/ui/map');
const GeolocateControl = require('../../../../js/ui/control/geolocate_control');

// window and navigator globals need to be set for mock-geolocation
global.window = {};
global.navigator = {};
const geolocation = require('mock-geolocation');
geolocation.use();

// assign the mock geolocation to window
global.window.navigator = global.navigator;
window.navigator.geolocation = global.window.navigator.geolocation;

function createMap() {
    const container = window.document.createElement('div');
    return new Map({
        container: container,
        style: {
            version: 8,
            sources: {},
            layers: []
        }
    });
}

test('GeolocateControl with no options', (t) => {
    const map = createMap();
    const geolocate = new GeolocateControl();
    map.addControl(geolocate);
    t.end();
});

test('GeolocateControl showMarker button state and ready event', (t) => {
    const map = createMap();
    const geolocate = new GeolocateControl();

    map.addControl(geolocate);

    geolocate.on('ready', () => {
        t.false(geolocate._geolocateButton.disabled, 'button enabled when control is ready');
        t.end();
    });
});

test('GeolocateControl error event', (t) => {
    const map = createMap();
    const geolocate = new GeolocateControl();
    map.addControl(geolocate);

    const click = new window.Event('click');

    geolocate.on('ready', () => {
        geolocate.on('error', (error) => {
            t.equal(error.code, 2, 'error code matches');
            t.equal(error.message, 'error message', 'error message matches');
            t.end();
        });
        geolocate._geolocateButton.dispatchEvent(click);
        geolocation.sendError({code: 2, message: 'error message'});
    });
});

test('GeolocateControl geolocate event', (t) => {
    const map = createMap();
    const geolocate = new GeolocateControl();
    map.addControl(geolocate);

    const click = new window.Event('click');

    geolocate.on('ready', () => {
        geolocate.on('geolocate', (position) => {
            t.equal(position.coords.latitude, 10, 'geolocate position latitude');
            t.equal(position.coords.longitude, 20, 'geolocate position longitude');
            t.equal(position.coords.accuracy, 30, 'geolocate position accuracy');
            t.equal(position.timestamp, 40, 'geolocate timestamp');
            t.end();
        });
        geolocate._geolocateButton.dispatchEvent(click);
        geolocation.send({latitude: 10, longitude: 20, accuracy: 30, timestamp: 40});
    });
});

test('GeolocateControl no watching map centered on geolocation', (t) => {
    const map = createMap();
    const geolocate = new GeolocateControl();
    map.addControl(geolocate);

    const click = new window.Event('click');

    geolocate.on('ready', () => {
        map.on('moveend', () => {
            t.deepEqual(map.getCenter(), { lat: 10, lng: 20 }, 'map centered on location');
            t.end();
        });
        geolocate._geolocateButton.dispatchEvent(click);
        geolocation.send({latitude: 10, longitude: 20, accuracy: 30});
    });
});
