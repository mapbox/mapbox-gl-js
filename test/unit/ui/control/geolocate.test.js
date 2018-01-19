'use strict';

const test = require('mapbox-gl-js-test').test;
const window = require('../../../../src/util/window');
const Map = require('../../../../src/ui/map');
const GeolocateControl = require('../../../../src/ui/control/geolocate_control');

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

// convert the coordinates of a LngLat object to a fixed number of digits
function lngLatAsFixed(lngLat, digits) {
    return Object.keys(lngLat).reduce((previous, current) => {
        previous[current] = lngLat[current].toFixed(digits);
        return previous;
    }, {});
}

test('GeolocateControl with no options', (t) => {
    t.plan(0);

    const map = createMap();
    const geolocate = new GeolocateControl();
    map.addControl(geolocate);
    t.end();
});

test('GeolocateControl error event', (t) => {
    t.plan(2);

    const map = createMap();
    const geolocate = new GeolocateControl();
    map.addControl(geolocate);

    const click = new window.Event('click');

    geolocate.on('error', (error) => {
        t.equal(error.code, 2, 'error code matches');
        t.equal(error.message, 'error message', 'error message matches');
        t.end();
    });
    geolocate._geolocateButton.dispatchEvent(click);
    geolocation.sendError({code: 2, message: 'error message'});
});

test('GeolocateControl geolocate event', (t) => {
    t.plan(4);

    const map = createMap();
    const geolocate = new GeolocateControl();
    map.addControl(geolocate);

    const click = new window.Event('click');

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

test('GeolocateControl geolocate fitBoundsOptions', (t) => {
    t.plan(1);

    const map = createMap();
    const geolocate = new GeolocateControl({
        fitBoundsOptions: {
            linear: true,
            duration: 0,
            maxZoom: 10
        }
    });
    map.addControl(geolocate);

    const click = new window.Event('click');

    map.once('moveend', () => {
        t.equal(map.getZoom(), 10, 'geolocate fitBounds maxZoom');
        t.end();
    });
    geolocate._geolocateButton.dispatchEvent(click);
    geolocation.send({latitude: 10, longitude: 20, accuracy: 1});
});

test('GeolocateControl no watching map camera on geolocation', (t) => {
    t.plan(6);

    const map = createMap();
    const geolocate = new GeolocateControl({
        fitBoundsOptions: {
            maxZoom: 20,
            linear: true,
            duration: 0
        }
    });
    map.addControl(geolocate);

    const click = new window.Event('click');

    map.on('moveend', () => {
        t.deepEqual(lngLatAsFixed(map.getCenter(), 4), { lat: 10, lng: 20 }, 'map centered on location');

        const mapBounds = map.getBounds();

        // map bounds should contain or equal accuracy bounds, that is the ensure accuracy bounds doesn't fall outside the map bounds
        const accuracyBounds = map.getCenter().toBounds(1000);
        t.ok(accuracyBounds.getNorth().toFixed(4) <= mapBounds.getNorth().toFixed(4), 'map contains north of accuracy radius');
        t.ok(accuracyBounds.getSouth().toFixed(4) >= mapBounds.getSouth().toFixed(4), 'map contains south of accuracy radius');
        t.ok(accuracyBounds.getEast().toFixed(4) <= mapBounds.getEast().toFixed(4), 'map contains east of accuracy radius');
        t.ok(accuracyBounds.getWest().toFixed(4) >= mapBounds.getWest().toFixed(4), 'map contains west of accuracy radius');

        // map bounds should not be too much bigger on all edges of the accuracy bounds (this test will only work for an orthogonal bearing),
        // ensures map bounds does not contain buffered accuracy bounds, as if it does there is too much gap around the accuracy bounds
        const bufferedAccuracyBounds = map.getCenter().toBounds(1100);
        t.notOk(
            (bufferedAccuracyBounds.getNorth().toFixed(4) < mapBounds.getNorth().toFixed(4)) &&
            (bufferedAccuracyBounds.getSouth().toFixed(4) > mapBounds.getSouth().toFixed(4)) &&
            (bufferedAccuracyBounds.getEast().toFixed(4) < mapBounds.getEast().toFixed(4)) &&
            (bufferedAccuracyBounds.getWest().toFixed(4) > mapBounds.getWest().toFixed(4)),
            'map bounds is much is larger than the accuracy radius');

        t.end();
    });
    geolocate._geolocateButton.dispatchEvent(click);
    geolocation.send({latitude: 10, longitude: 20, accuracy: 1000});
});

test('GeolocateControl watching map updates recenter on location with dot', (t) => {
    t.plan(6);

    const map = createMap();
    const geolocate = new GeolocateControl({
        trackUserLocation: true,
        showUserLocation: true,
        fitBoundsOptions: {
            linear: true,
            duration: 0
        }
    });
    map.addControl(geolocate);

    const click = new window.Event('click');

    let moveendCount = 0;
    map.once('moveend', () => {
        // moveend was being called a second time, this ensures that we don't run the tests a second time
        if (moveendCount > 0) return;
        moveendCount++;

        t.deepEqual(lngLatAsFixed(map.getCenter(), 4), { lat: 10, lng: 20 }, 'map centered on location after 1st update');
        t.ok(geolocate._userLocationDotMarker._map, 'userLocation dot marker on map');
        t.false(geolocate._userLocationDotMarker._element.classList.contains('mapboxgl-user-location-dot-stale'), 'userLocation does not have stale class');
        map.once('moveend', () => {
            t.deepEqual(lngLatAsFixed(map.getCenter(), 4), { lat: 40, lng: 50 }, 'map centered on location after 2nd update');
            geolocate.once('error', () => {
                t.ok(geolocate._userLocationDotMarker._map, 'userLocation dot  marker on map');
                t.ok(geolocate._userLocationDotMarker._element.classList.contains('mapboxgl-user-location-dot-stale'), 'userLocation has stale class');
                t.end();
            });
            geolocation.changeError({code: 2, message: 'position unavaliable'});
        });
        geolocation.change({latitude: 40, longitude: 50, accuracy: 60});
    });
    geolocate._geolocateButton.dispatchEvent(click);
    geolocation.send({latitude: 10, longitude: 20, accuracy: 30});
});

test('GeolocateControl watching map background event', (t) => {
    t.plan(0);

    const map = createMap();
    const geolocate = new GeolocateControl({
        trackUserLocation: true,
        fitBoundsOptions: {
            linear: true,
            duration: 0
        }
    });
    map.addControl(geolocate);

    const click = new window.Event('click');

    let moveendCount = 0;
    map.once('moveend', () => {
        // moveend was being called a second time, this ensures that we don't run the tests a second time
        if (moveendCount > 0) return;
        moveendCount++;

        geolocate.once('trackuserlocationend', () => {
            t.end();
        });

        // manually pan the map away from the geolocation position which should trigger the 'trackuserlocationend' event above
        map.jumpTo({
            center: [10, 5]
        });
    });
    // click the button to activate it into the enabled watch state
    geolocate._geolocateButton.dispatchEvent(click);
    // send through a location update which should reposition the map and trigger the 'moveend' event above
    geolocation.send({latitude: 10, longitude: 20, accuracy: 30});
});

test('GeolocateControl watching map background state', (t) => {
    t.plan(1);

    const map = createMap();
    const geolocate = new GeolocateControl({
        trackUserLocation: true,
        fitBoundsOptions: {
            linear: true,
            duration: 0
        }
    });
    map.addControl(geolocate);

    const click = new window.Event('click');

    let moveendCount = 0;
    map.once('moveend', () => {
        // moveend was being called a second time, this ensures that we don't run the tests a second time
        if (moveendCount > 0) return;
        moveendCount++;

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

test('GeolocateControl trackuserlocationstart event', (t) => {
    t.plan(0);

    const map = createMap();
    const geolocate = new GeolocateControl({
        trackUserLocation: true,
        fitBoundsOptions: {
            linear: true,
            duration: 0
        }
    });
    map.addControl(geolocate);

    const click = new window.Event('click');

    geolocate.once('trackuserlocationstart', () => {
        geolocate.once('trackuserlocationend', () => {
            geolocate.once('trackuserlocationstart', () => {
                t.end();
            });
            // click the geolocate control button again which should transition back to active_lock state
            geolocate._geolocateButton.dispatchEvent(click);
        });

        // manually pan the map away from the geolocation position which should trigger the 'trackuserlocationend' event above
        map.jumpTo({
            center: [10, 5]
        });
    });
    geolocate._geolocateButton.dispatchEvent(click);
    geolocation.send({latitude: 10, longitude: 20, accuracy: 30, timestamp: 40});
});
