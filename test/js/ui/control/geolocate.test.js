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

test('GeolocateControl watching map updates recenter on location with marker', (t) => {
    const map = createMap();
    const geolocate = new GeolocateControl({
        watchPosition: true,
        showMarker: true,
        markerPaintProperties: {
            'circle-radius': 10,
            'circle-color': '#000',
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 2
        },
        markerStalePaintProperties: {
            'circle-color': '#f00',
        }
    });
    map.addControl(geolocate);

    const click = new window.Event('click');

    geolocate.on('ready', () => {
        map.once('moveend', () => {
            t.deepEqual(map.getCenter(), { lat: 10, lng: 20 }, 'map centered on location after 1st update');
            t.ok(map.getLayer('_geolocate-control-marker'), 'has marker layer');
            t.equals(map.getPaintProperty('_geolocate-control-marker', 'circle-color'), '#000', 'markerPaintProperty circle-color');
            map.once('moveend', () => {
                t.deepEqual(map.getCenter(), { lat: 40, lng: 50 }, 'map centered on location after 2nd update');
                geolocate.once('error', () => {
                    t.equals(map.getPaintProperty('_geolocate-control-marker', 'circle-color'), '#f00', 'markerStalePaintProperty circle-color');
                    t.end();
                });
                geolocation.changeError({code: 2, message: 'position unavaliable'});
            });
            geolocation.change({latitude: 40, longitude: 50, accuracy: 60});
        });
        geolocate._geolocateButton.dispatchEvent(click);
        geolocation.send({latitude: 10, longitude: 20, accuracy: 30});
    });
});

test('GeolocateControl watching map background event', (t) => {
    const map = createMap();
    const geolocate = new GeolocateControl({
        watchPosition: true
    });
    map.addControl(geolocate);

    const click = new window.Event('click');

    // when the geolocate control is ready
    geolocate.once('ready', () => {
        map.once('moveend', () => {
            geolocate.once('background', () => {
                t.end();
            });

            // manually pan the map away from the geolocation position which should trigger the 'background' event above
            map.jumpTo({
                center: [10, 5]
            });
        });
        // click the button to activate it into the enabled watch state
        geolocate._geolocateButton.dispatchEvent(click);
        // send through a location update which should reposition the map and trigger the 'moveend' event above
        geolocation.send({latitude: 10, longitude: 20, accuracy: 30});
    });
});

test('GeolocateControl watching map background state', (t) => {
    const map = createMap();
    const geolocate = new GeolocateControl({
        watchPosition: true
    });
    map.addControl(geolocate);

    const click = new window.Event('click');

    // when the geolocate control is ready
    geolocate.once('ready', () => {
        map.once('moveend', () => {
            map.once('moveend', () => {
                geolocate.once('geolocate', () => {
                    t.deepEquals(map.getCenter(), {lng: 10, lat: 5}, 'camera not changed after geolocation update in background state');
                    t.end();
                });
                //  update the geolocation position, since we are in background state when 'geolocate' is triggered above, the camera shouldn't have changed
                geolocation.change({latitude: 0, longitude: 0, accuracy: 10});
            });

            // manually pan the map away from the geolocation position which should trigger the 'moveend' event above
            map.jumpTo({
                center: [10, 5]
            });
        });
        // click the button to activate it into the enabled watch state
        geolocate._geolocateButton.dispatchEvent(click);
        // send through a location update which should reposition the map and trigger the 'moveend' event above
        geolocation.send({latitude: 10, longitude: 20, accuracy: 30});
    });
});

test('GeolocateControl active_lock event', (t) => {
    console.log('start final test');
    const map = createMap();
    const geolocate = new GeolocateControl({
        watchPosition: true
    });
    map.addControl(geolocate);

    const click = new window.Event('click');

    geolocate.once('ready', () => {
        geolocate.once('active_lock', () => {
            geolocate.once('background', () => {
                geolocate.once('active_lock', () => {
                    t.end();
                });
                // click the geolocate control button again which should transition back to active_lock state
                geolocate._geolocateButton.dispatchEvent(click);
            });

            // manually pan the map away from the geolocation position which should trigger the 'background' event above
            map.jumpTo({
                center: [10, 5]
            });
        });
        geolocate._geolocateButton.dispatchEvent(click);
        geolocation.send({latitude: 10, longitude: 20, accuracy: 30, timestamp: 40});
    });
});
