import {test, beforeAll, beforeEach, expect, vi, createMap} from "../../../util/vitest.js";
import GeolocateControl from '../../../../src/ui/control/geolocate_control.js';
import mockGeolocation from 'mock-geolocation';

beforeAll(() => {
    mockGeolocation.use();
});

beforeEach(() => {
    vi.spyOn(window.navigator.permissions, 'query').mockImplementation(async () => {
        return {state: 'granted'};
    });
});

// convert the coordinates of a LngLat object to a fixed number of digits
function lngLatAsFixed(lngLat, digits) {
    return Object.keys(lngLat).reduce((previous, current) => {
        previous[current] = lngLat[current].toFixed(digits);
        return previous;
    }, {});
}

function afterUIChanges(cb) {
    return new Promise(resolve => {
        setTimeout(() => {
            cb(resolve);
        }, 0);
    });
}

test('GeolocateControl with no options', async () => {
    const map = createMap();

    const geolocate = new GeolocateControl();
    map.addControl(geolocate);

    await afterUIChanges((resolve) => {
        expect(geolocate._geolocateButton.disabled).toEqual(false);
        resolve();
    });
});

test('GeolocateControl error event', async () => {
    const map = createMap();
    const geolocate = new GeolocateControl();
    map.addControl(geolocate);

    const click = new window.Event('click');

    await afterUIChanges((resolve) => {
        geolocate.on('error', (error) => {
            expect(error.code).toEqual(2);
            expect(error.message).toEqual('error message');
            resolve();
        });
        geolocate._geolocateButton.dispatchEvent(click);
        mockGeolocation.sendError({code: 2, message: 'error message'});
    });
});

test('GeolocateControl outofmaxbounds event in active lock state', async () => {
    const map = createMap();
    const geolocate = new GeolocateControl();
    map.addControl(geolocate);
    map.setMaxBounds([[0, 0], [10, 10]]);
    geolocate._watchState = 'ACTIVE_LOCK';

    await afterUIChanges((resolve) => {
        const click = new window.Event('click');

        geolocate.on('outofmaxbounds', (position) => {
            expect(geolocate._watchState).toEqual('ACTIVE_ERROR');
            expect(position.coords.latitude).toEqual(10);
            expect(position.coords.longitude).toEqual(20);
            expect(position.coords.accuracy).toEqual(3);
            expect(position.timestamp).toEqual(4);
            resolve();
        });
        geolocate._geolocateButton.dispatchEvent(click);
        mockGeolocation.send({latitude: 10, longitude: 20, accuracy: 3, timestamp: 4});
    });
});

test('GeolocateControl outofmaxbounds event in background state', async () => {
    const map = createMap();
    const geolocate = new GeolocateControl();
    map.addControl(geolocate);
    map.setMaxBounds([[0, 0], [10, 10]]);
    geolocate._watchState = 'BACKGROUND';

    const click = new window.Event('click');

    await afterUIChanges((resolve) => {
        geolocate.on('outofmaxbounds', (position) => {
            expect(geolocate._watchState).toEqual('BACKGROUND_ERROR');
            expect(position.coords.latitude).toEqual(10);
            expect(position.coords.longitude).toEqual(20);
            expect(position.coords.accuracy).toEqual(3);
            expect(position.timestamp).toEqual(4);
            resolve();
        });
        geolocate._geolocateButton.dispatchEvent(click);
        mockGeolocation.send({latitude: 10, longitude: 20, accuracy: 3, timestamp: 4});
    });
});

test('GeolocateControl geolocate event', async () => {
    expect.assertions(4);

    const map = createMap();
    const geolocate = new GeolocateControl();
    map.addControl(geolocate);

    const click = new window.Event('click');

    await afterUIChanges((resolve) => {
        geolocate.on('geolocate', (position) => {
            expect(position.coords.latitude).toEqual(10);
            expect(position.coords.longitude).toEqual(20);
            expect(position.coords.accuracy).toEqual(30);
            expect(position.timestamp).toEqual(40);
            resolve();
        });
        geolocate._geolocateButton.dispatchEvent(click);
        mockGeolocation.send({latitude: 10, longitude: 20, accuracy: 30, timestamp: 40});
    });
});

test('GeolocateControl trigger', async () => {
    const map = createMap();
    const geolocate = new GeolocateControl();
    map.addControl(geolocate);

    await afterUIChanges((resolve) => {
        geolocate.on('geolocate', resolve);
        expect(geolocate.trigger()).toBeTruthy();
        mockGeolocation.send({latitude: 10, longitude: 20, accuracy: 30, timestamp: 40});
    });
});

test('GeolocateControl trigger before added to map', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const geolocate = new GeolocateControl();

    expect(geolocate.trigger()).toBeFalsy();
    expect(console.warn).toHaveBeenCalledWith('Geolocate control triggered before added to a map');
});

test('GeolocateControl geolocate fitBoundsOptions', async () => {
    const map = createMap();
    const geolocate = new GeolocateControl({
        fitBoundsOptions: {
            linear: true,
            duration: 0,
            maxZoom: 10
        }
    });
    map.addControl(geolocate);

    await afterUIChanges((resolve) => {
        const click = new window.Event('click');

        map.once('moveend', () => {
            expect(map.getZoom()).toEqual(10);
            resolve();
        });
        geolocate._geolocateButton.dispatchEvent(click);
        mockGeolocation.send({latitude: 10, longitude: 20, accuracy: 1});
    });
});

test('GeolocateControl with removed before Geolocation callback', () => {
    const map = createMap();
    const geolocate = new GeolocateControl();
    map.addControl(geolocate);
    geolocate.trigger();
    map.removeControl(geolocate);
});

test('GeolocateControl non-zero bearing', async () => {
    const map = createMap();
    map.setBearing(45);
    const geolocate = new GeolocateControl({
        fitBoundsOptions: {
            linear: true,
            duration: 0,
            maxZoom: 10
        }
    });
    map.addControl(geolocate);

    await afterUIChanges((resolve) => {
        const click = new window.Event('click');

        map.once('moveend', () => {
            expect(lngLatAsFixed(map.getCenter(), 4)).toEqual({lat: "10.0000", lng: "20.0000"});
            expect(map.getBearing()).toEqual(45);
            expect(map.getZoom()).toEqual(10);
            resolve();
        });
        geolocate._geolocateButton.dispatchEvent(click);
        mockGeolocation.send({latitude: 10, longitude: 20, accuracy: 1});
    });
});

test('GeolocateControl no watching map camera on geolocation', async () => {
    const map = createMap();
    const geolocate = new GeolocateControl({
        fitBoundsOptions: {
            maxZoom: 20,
            linear: true,
            duration: 0
        }
    });
    map.addControl(geolocate);

    await afterUIChanges((resolve) => {
        const click = new window.Event('click');

        map.once('moveend', () => {
            expect(lngLatAsFixed(map.getCenter(), 4)).toEqual({lat: "10.0000", lng: "20.0000"});

            const mapBounds = map.getBounds();

            // map bounds should contain or equal accuracy bounds, that is the ensure accuracy bounds doesn't fall outside the map bounds
            const accuracyBounds = map.getCenter().toBounds(1000);
            expect(accuracyBounds.getNorth().toFixed(4) <= mapBounds.getNorth().toFixed(4)).toBeTruthy();
            expect(accuracyBounds.getSouth().toFixed(4) >= mapBounds.getSouth().toFixed(4)).toBeTruthy();
            expect(accuracyBounds.getEast().toFixed(4) <= mapBounds.getEast().toFixed(4)).toBeTruthy();
            expect(accuracyBounds.getWest().toFixed(4) >= mapBounds.getWest().toFixed(4)).toBeTruthy();

            // map bounds should not be too much bigger on all edges of the accuracy bounds (this test will only work for an orthogonal bearing),
            // ensures map bounds does not contain buffered accuracy bounds, as if it does there is too much gap around the accuracy bounds
            const bufferedAccuracyBounds = map.getCenter().toBounds(1100);
            expect(
                (bufferedAccuracyBounds.getNorth().toFixed(4) < mapBounds.getNorth().toFixed(4)) &&
                (bufferedAccuracyBounds.getSouth().toFixed(4) > mapBounds.getSouth().toFixed(4)) &&
                (bufferedAccuracyBounds.getEast().toFixed(4) < mapBounds.getEast().toFixed(4)) &&
                (bufferedAccuracyBounds.getWest().toFixed(4) > mapBounds.getWest().toFixed(4))
            ).toBeFalsy();
            resolve();
        });
        geolocate._geolocateButton.dispatchEvent(click);
        mockGeolocation.send({latitude: 10, longitude: 20, accuracy: 1000});
    });
});

test('GeolocateControl watching map updates recenter on location with dot', async () => {
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

    await afterUIChanges((resolve) => {
        const click = new window.Event('click');

        let moveendCount = 0;
        map.once('moveend', () => {
        // moveend was being called a second time, this ensures that we don't run the tests a second time
            if (moveendCount > 0) return;
            moveendCount++;

            expect(lngLatAsFixed(map.getCenter(), 4)).toEqual({lat: "10.0000", lng: "20.0000"});
            expect(geolocate._userLocationDotMarker._map).toBeTruthy();
            expect(
                geolocate._userLocationDotMarker._element.classList.contains('mapboxgl-user-location-dot-stale')
            ).toBeFalsy();
            map.once('moveend', () => {
                expect(lngLatAsFixed(map.getCenter(), 4)).toEqual({lat: "40.0000", lng: "50.0000"});
                geolocate.once('error', () => {
                    expect(geolocate._userLocationDotMarker._map).toBeTruthy();
                    expect(
                        geolocate._userLocationDotMarker._element.classList.contains('mapboxgl-user-location-dot-stale')
                    ).toBeTruthy();
                });
                mockGeolocation.changeError({code: 2, message: 'position unavailable'});
                resolve();
            });
            mockGeolocation.change({latitude: 40, longitude: 50, accuracy: 60});
        });
        geolocate._geolocateButton.dispatchEvent(click);
        mockGeolocation.send({latitude: 10, longitude: 20, accuracy: 30});
    });
});

test('GeolocateControl watching map background event', async () => {
    const map = createMap();

    const geolocate = new GeolocateControl({
        trackUserLocation: true,
        fitBoundsOptions: {
            linear: true,
            duration: 0
        }
    });
    map.addControl(geolocate);

    await afterUIChanges((resolve) => {
        const click = new window.Event('click');

        let moveendCount = 0;
        map.once('moveend', () => {
        // moveend was being called a second time, this ensures that we don't run the tests a second time
            if (moveendCount > 0) return;
            moveendCount++;

            geolocate.once('trackuserlocationend', resolve);

            // manually pan the map away from the geolocation position which should trigger the 'trackuserlocationend' event above
            map.jumpTo({
                center: [10, 5]
            });
        });
        // click the button to activate it into the enabled watch state
        geolocate._geolocateButton.dispatchEvent(click);
        // send through a location update which should reposition the map and trigger the 'moveend' event above
        mockGeolocation.send({latitude: 10, longitude: 20, accuracy: 30});
    });
});

test('GeolocateControl watching map background state', async () => {
    const map = createMap();
    const geolocate = new GeolocateControl({
        trackUserLocation: true,
        fitBoundsOptions: {
            linear: true,
            duration: 0
        }
    });
    map.addControl(geolocate);

    await afterUIChanges((resolve) => {
        const click = new window.Event('click');

        let moveendCount = 0;
        map.once('moveend', () => {
        // moveend was being called a second time, this ensures that we don't run the tests a second time
            if (moveendCount > 0) return;
            moveendCount++;

            map.once('moveend', () => {
                geolocate.once('geolocate', () => {
                    expect(map.getCenter()).toEqual({lng: 10, lat: 5}); // camera not changed after geolocation update in background state
                    resolve();
                });
                //  update the geolocation position, since we are in background state when 'geolocate' is triggered above, the camera shouldn't have changed
                mockGeolocation.change({latitude: 0, longitude: 0, accuracy: 10});
            });

            // manually pan the map away from the geolocation position which should trigger the 'moveend' event above
            map.jumpTo({
                center: [10, 5]
            });
        });
        // click the button to activate it into the enabled watch state
        geolocate._geolocateButton.dispatchEvent(click);
        // send through a location update which should reposition the map and trigger the 'moveend' event above
        mockGeolocation.send({latitude: 10, longitude: 20, accuracy: 30});
    });
});

test('GeolocateControl trackuserlocationstart event', async () => {
    const map = createMap();

    const geolocate = new GeolocateControl({
        trackUserLocation: true,
        fitBoundsOptions: {
            linear: true,
            duration: 0
        }
    });
    map.addControl(geolocate);

    await afterUIChanges(async (resolve) => {
        const click = new window.Event('click');

        geolocate.once('geolocate', () => {
            geolocate.once('trackuserlocationend', () => {
                geolocate.once('trackuserlocationstart', resolve);
                // click the geolocate control button again which should transition back to active_lock state
                geolocate._geolocateButton.dispatchEvent(click);
            });

            // manually pan the map away from the geolocation position which should trigger the 'trackuserlocationend' event above
            map.jumpTo({
                center: [10, 5]
            });
        });

        geolocate._geolocateButton.dispatchEvent(click);
        mockGeolocation.send({latitude: 10, longitude: 20, accuracy: 30, timestamp: 40});
    });
});

test('GeolocateControl does not switch to BACKGROUND and stays in ACTIVE_LOCK state on window resize', async () => {
    const map = createMap();
    const geolocate = new GeolocateControl({
        trackUserLocation: true,
    });
    map.addControl(geolocate);

    await afterUIChanges((resolve) => {
        const click = new window.Event('click');

        geolocate.once('geolocate', () => {
            expect(geolocate._watchState).toEqual('ACTIVE_LOCK');
            window.dispatchEvent(new window.Event('resize'));
            expect(geolocate._watchState).toEqual('ACTIVE_LOCK');
            resolve();
        });

        geolocate._geolocateButton.dispatchEvent(click);
        mockGeolocation.send({latitude: 10, longitude: 20, accuracy: 30, timestamp: 40});
    });
});

test('GeolocateControl switches to BACKGROUND state on map manipulation', async () => {
    const map = createMap();
    const geolocate = new GeolocateControl({
        trackUserLocation: true,
    });
    map.addControl(geolocate);

    await afterUIChanges((resolve) => {
        const click = new window.Event('click');

        geolocate.once('geolocate', () => {
            expect(geolocate._watchState).toEqual('ACTIVE_LOCK');
            map.jumpTo({
                center: [0, 0]
            });
            expect(geolocate._watchState).toEqual('BACKGROUND');
            resolve();
        });

        geolocate._geolocateButton.dispatchEvent(click);
        mockGeolocation.send({latitude: 10, longitude: 20, accuracy: 30, timestamp: 40});
    });
});

test('GeolocateControl accuracy circle radius is accurate with Globe projection', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const map = createMap({projection: 'globe'});
    const geolocate = new GeolocateControl({
        trackUserLocation: true,
        showUserLocation: true,
    });
    map.addControl(geolocate);

    await afterUIChanges((resolve) => {
        const click = new window.Event('click');

        geolocate.once('geolocate', () => {
            expect(geolocate._accuracyCircleMarker._map).toBeTruthy();
            expect(geolocate._accuracy).toEqual(2000);
            map.once('zoomend', () => {
                expect(geolocate._circleElement.style.width).toEqual('1px'); // 2000m = 1px at zoom 0
                resolve();
            });
            map.zoomTo(0, {duration: 0});
        });

        geolocate._geolocateButton.dispatchEvent(click);
        mockGeolocation.send({latitude: 10, longitude: 20, accuracy: 2000});
    });
});

test('GeolocateControl accuracy circle not shown if showAccuracyCircle = false', async () => {
    const map = createMap();
    const geolocate = new GeolocateControl({
        trackUserLocation: true,
        showUserLocation: true,
        showAccuracyCircle: false,
    });
    map.addControl(geolocate);

    await afterUIChanges((resolve) => {
        const click = new window.Event('click');

        geolocate.once('geolocate', () => {
            map.jumpTo({
                center: [10, 20]
            });
            map.once('zoomend', () => {
                expect(!geolocate._circleElement.style.width).toBeTruthy();
                resolve();
            });
            map.zoomTo(10, {duration: 0});
        });

        geolocate._geolocateButton.dispatchEvent(click);
        mockGeolocation.send({latitude: 10, longitude: 20, accuracy: 700});
    });
});

test('GeolocateControl accuracy circle radius matches reported accuracy', async () => {
    const map = createMap();
    const geolocate = new GeolocateControl({
        trackUserLocation: true,
        showUserLocation: true,
    });
    map.addControl(geolocate);

    await afterUIChanges((resolve) => {
        const click = new window.Event('click');

        geolocate.once('geolocate', () => {
            expect(geolocate._accuracyCircleMarker._map).toBeTruthy();
            expect(geolocate._accuracy).toEqual(700);
            map.jumpTo({
                center: [10, 20]
            });
            map.once('zoomend', () => {
                expect(geolocate._circleElement.style.width).toEqual('20px'); // 700m = 20px at zoom 10
                map.once('zoomend', () => {
                    expect(geolocate._circleElement.style.width).toEqual('79px'); // 700m = 79px at zoom 12
                    resolve();
                });
                map.zoomTo(12, {duration: 0});
            });
            map.zoomTo(10, {duration: 0});
        });

        geolocate._geolocateButton.dispatchEvent(click);
        mockGeolocation.send({latitude: 10, longitude: 20, accuracy: 700});
    });
});

test("GeolocateControl accuracy circle doesn't flicker in size", async () => {
    const map = createMap();
    const geolocate = new GeolocateControl({
        trackUserLocation: true,
        showUserLocation: true,
    });
    map.addControl(geolocate);

    await afterUIChanges((resolve) => {
        geolocate.once('geolocate', () => {
            expect(geolocate._accuracyCircleMarker._map).toBeTruthy();
            expect(geolocate._accuracy).toEqual(150);
            map.jumpTo({
                center: [20.123123, 10.123123]
            });
            map.once('zoomend', () => {
                const circleWidth = geolocate._circleElement.style.width;
                map.once('zoomend', () => {
                    map.once('zoomend', () => {
                        expect(geolocate._circleElement.style.width).toEqual(circleWidth);
                        resolve();
                    });
                    map.zoomTo(18, {duration: 0});
                });
                map.panBy([123, 123], {duration:0});
                map.zoomTo(17, {duration: 0});
            });
            map.zoomTo(18, {duration: 0});
        });

        geolocate._geolocateButton.dispatchEvent(new window.Event('click'));
        mockGeolocation.send({longitude: 20.123123, latitude: 10.123123, accuracy: 150});
    });
});

test('GeolocateControl shown even if trackUserLocation = false', async () => {
    const map = createMap();
    const geolocate = new GeolocateControl({
        trackUserLocation: false,
        showUserLocation: true,
        showAccuracyCircle: true,
    });
    map.addControl(geolocate);

    await afterUIChanges((resolve) => {
        const click = new window.Event('click');

        geolocate.once('geolocate', () => {
            map.jumpTo({
                center: [10, 20]
            });
            map.once('zoomend', () => {
                expect(geolocate._circleElement.style.width).toBeTruthy();
                resolve();
            });
            map.zoomTo(10, {duration: 0});
        });

        geolocate._geolocateButton.dispatchEvent(click);
        mockGeolocation.send({latitude: 10, longitude: 20, accuracy: 700});
    });
});

test('GeolocateControl watching device orientation event', async () => {
    const map = createMap();
    const geolocate = new GeolocateControl({
        fitBoundsOptions: {
            linear: true,
            duration: 0
        },
        showUserHeading: true,
        showUserLocation: true,
        trackUserLocation: true,
    });
    map.addControl(geolocate);

    await afterUIChanges((resolve) => {
        const click = new window.Event('click');

        // since DeviceOrientationEvent is not supported: https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent
        const deviceOrientationEventLike = (alpha) => {
            const instance = new window.Event('deviceorientationabsolute');
            instance.alpha = alpha;
            instance.absolute = true;
            return instance;
        };

        expect(
            geolocate._dotElement.classList.contains('mapboxgl-user-location-show-heading')
        ).toBeFalsy();

        const eventListenerSpy = vi.spyOn(window, 'addEventListener');

        let moveendCount = 0;
        map.once('moveend', () => {
        // moveend was being called a second time, this ensures that we don't run the tests a second time
            if (moveendCount > 0) return;
            moveendCount++;
            expect(lngLatAsFixed(map.getCenter(), 4)).toEqual({lat: "10.0000", lng: "20.0000"});
            expect(geolocate._userLocationDotMarker._map).toBeTruthy();
            expect(
                geolocate._userLocationDotMarker._element.classList.contains('mapboxgl-user-location-dot-stale')
            ).toBeFalsy();
            geolocate.once('trackuserlocationend', () => {
                expect(eventListenerSpy.mock.calls[0][0]).toEqual('deviceorientationabsolute');

                const event = deviceOrientationEventLike(-359);
                window.dispatchEvent(event);
                setTimeout(() => {
                    expect(
                        geolocate._dotElement.classList.contains('mapboxgl-user-location-show-heading')
                    ).toBeTruthy();
                    expect(geolocate._userLocationDotMarker._rotation).toEqual(359);

                    const event = deviceOrientationEventLike(-15);
                    window.dispatchEvent(event);
                    setTimeout(() => {
                        expect(geolocate._userLocationDotMarker._rotation).toEqual(15);
                        resolve();
                    }, 20); // After throttle
                }, 0);
            });
            // manually pan the map away from the geolocation position which should trigger the 'trackuserlocationend' event above
            map.jumpTo({
                center: [20, 10]
            });
        });
        geolocate._geolocateButton.dispatchEvent(click);
        mockGeolocation.send({latitude: 10, longitude: 20, accuracy: 30});
    });
});
