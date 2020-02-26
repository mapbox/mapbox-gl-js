import {test} from '../../../util/test';
import window from '../../../../src/util/window';
import {createMap} from '../../../util';
import GeolocateControl from '../../../../src/ui/control/geolocate_control';

// window and navigator globals need to be set for mock-geolocation
global.window = {};
global.navigator = {};
const geolocation = require('mock-geolocation'); // eslint-disable-line import/no-commonjs
geolocation.use();

// assign the mock geolocation to window
global.window.navigator = global.navigator;
window.navigator.geolocation = global.window.navigator.geolocation;

// convert the coordinates of a LngLat object to a fixed number of digits
function lngLatAsFixed(lngLat, digits) {
    return Object.keys(lngLat).reduce((previous, current) => {
        previous[current] = lngLat[current].toFixed(digits);
        return previous;
    }, {});
}

test('GeolocateControl with no options', (t) => {
    const map = createMap(t);
    t.plan(0);

    const geolocate = new GeolocateControl();
    map.addControl(geolocate);
    t.end();
});

test('GeolocateControl error event', (t) => {
    t.plan(2);

    const map = createMap(t);
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

test('GeolocateControl outofmaxbounds event in active lock state', (t) => {
    t.plan(5);

    const map = createMap(t);
    const geolocate = new GeolocateControl();
    map.addControl(geolocate);
    map.setMaxBounds([[0, 0], [10, 10]]);
    geolocate._watchState = 'ACTIVE_LOCK';

    const click = new window.Event('click');

    geolocate.on('outofmaxbounds', (position) => {
        t.equal(geolocate._watchState, 'ACTIVE_ERROR', 'geolocate state');
        t.equal(position.coords.latitude, 10, 'geolocate position latitude');
        t.equal(position.coords.longitude, 20, 'geolocate position longitude');
        t.equal(position.coords.accuracy, 3, 'geolocate position accuracy');
        t.equal(position.timestamp, 4, 'geolocate timestamp');
        t.end();
    });
    geolocate._geolocateButton.dispatchEvent(click);
    geolocation.send({latitude: 10, longitude: 20, accuracy: 3, timestamp: 4});
});

test('GeolocateControl outofmaxbounds event in background state', (t) => {
    t.plan(5);

    const map = createMap(t);
    const geolocate = new GeolocateControl();
    map.addControl(geolocate);
    map.setMaxBounds([[0, 0], [10, 10]]);
    geolocate._watchState = 'BACKGROUND';

    const click = new window.Event('click');

    geolocate.on('outofmaxbounds', (position) => {
        t.equal(geolocate._watchState, 'BACKGROUND_ERROR', 'geolocate state');
        t.equal(position.coords.latitude, 10, 'geolocate position latitude');
        t.equal(position.coords.longitude, 20, 'geolocate position longitude');
        t.equal(position.coords.accuracy, 3, 'geolocate position accuracy');
        t.equal(position.timestamp, 4, 'geolocate timestamp');
        t.end();
    });
    geolocate._geolocateButton.dispatchEvent(click);
    geolocation.send({latitude: 10, longitude: 20, accuracy: 3, timestamp: 4});
});

test('GeolocateControl geolocate event', (t) => {
    t.plan(4);

    const map = createMap(t);
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

test('GeolocateControl trigger', (t) => {
    t.plan(1);

    const map = createMap(t);
    const geolocate = new GeolocateControl();
    map.addControl(geolocate);

    geolocate.on('geolocate', () => {
        t.end();
    });
    t.true(geolocate.trigger());
    geolocation.send({latitude: 10, longitude: 20, accuracy: 30, timestamp: 40});
});

test('GeolocateControl trigger before added to map', (t) => {
    t.plan(2);
    t.stub(console, 'warn');

    const geolocate = new GeolocateControl();

    t.false(geolocate.trigger());
    t.ok(console.warn.calledWith('Geolocate control triggered before added to a map'));
    t.end();
});

test('GeolocateControl geolocate fitBoundsOptions', (t) => {
    t.plan(1);

    const map = createMap(t);
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

test('GeolocateControl with removed before Geolocation callback', (t) => {
    const map = createMap(t);
    t.plan(0);

    const geolocate = new GeolocateControl();
    map.addControl(geolocate);
    geolocate.trigger();
    map.removeControl(geolocate);
    t.end();
});

test('GeolocateControl non-zero bearing', (t) => {
    t.plan(3);

    const map = createMap(t);
    map.setBearing(45);
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
        t.deepEqual(lngLatAsFixed(map.getCenter(), 4), {lat: 10, lng: 20}, 'map centered on location');
        t.equal(map.getBearing(), 45, 'map bearing retained');
        t.equal(map.getZoom(), 10, 'geolocate fitBounds maxZoom');
        t.end();
    });
    geolocate._geolocateButton.dispatchEvent(click);
    geolocation.send({latitude: 10, longitude: 20, accuracy: 1});
});

test('GeolocateControl no watching map camera on geolocation', (t) => {
    t.plan(6);

    const map = createMap(t);
    const geolocate = new GeolocateControl({
        fitBoundsOptions: {
            maxZoom: 20,
            linear: true,
            duration: 0
        }
    });
    map.addControl(geolocate);

    const click = new window.Event('click');

    map.once('moveend', () => {
        t.deepEqual(lngLatAsFixed(map.getCenter(), 4), {lat: 10, lng: 20}, 'map centered on location');

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

    const map = createMap(t);
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

        t.deepEqual(lngLatAsFixed(map.getCenter(), 4), {lat: 10, lng: 20}, 'map centered on location after 1st update');
        t.ok(geolocate._userLocationDotMarker._map, 'userLocation dot marker on map');
        t.false(geolocate._userLocationDotMarker._element.classList.contains('mapboxgl-user-location-dot-stale'), 'userLocation does not have stale class');
        map.once('moveend', () => {
            t.deepEqual(lngLatAsFixed(map.getCenter(), 4), {lat: 40, lng: 50}, 'map centered on location after 2nd update');
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
    const map = createMap(t);
    t.plan(0);

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

    const map = createMap(t);
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
    const map = createMap(t);
    t.plan(0);

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

test('GeolocateControl does not switch to BACKGROUND and stays in ACTIVE_LOCK state on window resize', (t) => {
    const map = createMap(t);
    const geolocate = new GeolocateControl({
        trackUserLocation: true,
    });
    map.addControl(geolocate);

    const click = new window.Event('click');

    geolocate.once('geolocate', () => {
        t.equal(geolocate._watchState, 'ACTIVE_LOCK');
        window.dispatchEvent(new window.Event('resize'));
        t.equal(geolocate._watchState, 'ACTIVE_LOCK');
        t.end();
    });

    geolocate._geolocateButton.dispatchEvent(click);
    geolocation.send({latitude: 10, longitude: 20, accuracy: 30, timestamp: 40});
});

test('GeolocateControl switches to BACKGROUND state on map manipulation', (t) => {
    const map = createMap(t);
    const geolocate = new GeolocateControl({
        trackUserLocation: true,
    });
    map.addControl(geolocate);

    const click = new window.Event('click');

    geolocate.once('geolocate', () => {
        t.equal(geolocate._watchState, 'ACTIVE_LOCK');
        map.jumpTo({
            center: [0, 0]
        });
        t.equal(geolocate._watchState, 'BACKGROUND');
        t.end();
    });

    geolocate._geolocateButton.dispatchEvent(click);
    geolocation.send({latitude: 10, longitude: 20, accuracy: 30, timestamp: 40});
});

test('GeolocateControl accuracy circle not shown if showAccuracyCircle = false', (t) => {
    const map = createMap(t);
    const geolocate = new GeolocateControl({
        trackUserLocation: true,
        showUserLocation: true,
        showAccuracyCircle: false,
    });
    map.addControl(geolocate);

    const click = new window.Event('click');

    geolocate.once('geolocate', () => {
        map.jumpTo({
            center: [10, 20]
        });
        map.once('zoomend', () => {
            t.ok(!geolocate._circleElement.style.width);
            t.end();
        });
        map.zoomTo(10, {duration: 0});
    });

    geolocate._geolocateButton.dispatchEvent(click);
    geolocation.send({latitude: 10, longitude: 20, accuracy: 700});
});

test('GeolocateControl accuracy circle radius matches reported accuracy', (t) => {
    const map = createMap(t);
    const geolocate = new GeolocateControl({
        trackUserLocation: true,
        showUserLocation: true,
    });
    map.addControl(geolocate);

    const click = new window.Event('click');

    geolocate.once('geolocate', () => {
        t.ok(geolocate._accuracyCircleMarker._map, 'userLocation accuracy circle marker on map');
        t.equal(geolocate._accuracy, 700);
        map.jumpTo({
            center: [10, 20]
        });
        map.once('zoomend', () => {
            t.equal(geolocate._circleElement.style.width, '20px'); // 700m = 20px at zoom 10
            map.once('zoomend', () => {
                t.equal(geolocate._circleElement.style.width, '79px'); // 700m = 79px at zoom 12
                t.end();
            });
            map.zoomTo(12, {duration: 0});
        });
        map.zoomTo(10, {duration: 0});
    });

    geolocate._geolocateButton.dispatchEvent(click);
    geolocation.send({latitude: 10, longitude: 20, accuracy: 700});
});

test('GeolocateControl shown even if trackUserLocation = false', (t) => {
    const map = createMap(t);
    const geolocate = new GeolocateControl({
        trackUserLocation: false,
        showUserLocation: true,
        showAccuracyCircle: true,
    });
    map.addControl(geolocate);

    const click = new window.Event('click');

    geolocate.once('geolocate', () => {
        map.jumpTo({
            center: [10, 20]
        });
        map.once('zoomend', () => {
            t.ok(geolocate._circleElement.style.width);
            t.end();
        });
        map.zoomTo(10, {duration: 0});
    });

    geolocate._geolocateButton.dispatchEvent(click);
    geolocation.send({latitude: 10, longitude: 20, accuracy: 700});
});
