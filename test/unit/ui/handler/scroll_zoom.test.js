import {describe, test, expect, waitFor, vi, createMap, equalWithPrecision, beforeEach} from "../../../util/vitest.js";
import browser from '../../../../src/util/browser.js';
import simulate from '../../../util/simulate_interaction.js';
import {createConstElevationDEM, setMockElevationTerrain} from '../../../util/dem_mock.js';
import {fixedNum} from '../../../util/fixed.js';
import MercatorCoordinate from '../../../../src/geo/mercator_coordinate.js';

function createMapWithCooperativeGestures() {
    return createMap({
        interactive: true,
        cooperativeGestures: true,
        testMode: true,
    });
}

describe('ScrollZoomHandler', () => {
    let now;
    beforeEach(() => {
        now = 1555555555555;
        vi.spyOn(browser, 'now').mockImplementation(() => now);
    });

    test('Zooms for single mouse wheel tick', () => {
        const map = createMap({
            interactive: true
        });
        map._renderTaskQueue.run();

        // simulate a single 'wheel' event
        const startZoom = map.getZoom();

        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();

        now += 400;
        map._renderTaskQueue.run();

        equalWithPrecision(map.getZoom() - startZoom,  0.0285, 0.001);

        map.remove();
    });

    test('Zooms for single mouse wheel tick with non-magical deltaY', async () => {
        const map = createMap({
            interactive: true
        });
        map._renderTaskQueue.run();

        // Simulate a single 'wheel' event without the magical deltaY value.
        // This requires the handler to briefly wait to see if a subsequent
        // event is coming in order to guess trackpad vs. mouse wheel
        await new Promise(resolve => {
            map.once("zoomstart", () => {
                resolve();
            });
            simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -20});
        });
        map.remove();
    });

    /**
     * @note Flacky
     */
    test.skip('Zooms for multiple mouse wheel ticks', () => {
        const map = createMap({
            interactive: true
        });

        map._renderTaskQueue.run();
        const startZoom = map.getZoom();

        const events = [
            [2, {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta}],
            [7, {type: 'wheel', deltaY: -41}],
            [30, {type: 'wheel', deltaY: -169}],
            [1, {type: 'wheel', deltaY: -801}],
            [5, {type: 'wheel', deltaY: -326}],
            [20, {type: 'wheel', deltaY: -345}],
            [22, {type: 'wheel', deltaY: -376}],
        ];

        const end = now + 500;
        let lastWheelEvent = now;
        // simulate the above sequence of wheel events, with render frames
        // interspersed every 20ms
        while (now++ < end) {
            if (events.length && lastWheelEvent + events[0][0] === now) {
                const [, event] = events.shift();
                simulate.wheel(map.getCanvas(), event);
                lastWheelEvent = now;
            }
            if (now % 20 === 0) {
                map._renderTaskQueue.run();
            }
        }
        equalWithPrecision(map.getZoom() - startZoom,  1.944, 0.001);

        map.remove();
    });

    describe('Terrain', () => {
        const tileSize = 128;
        const deltas = [100, 10, 123, 45, 1, -10, -100];
        const expected = [10, 9.41454, 8.78447, 8.49608, 8.48888, 8.55921, 9.10727];

        const zeroElevationDem = createConstElevationDEM(0, tileSize);
        const highElevationDem = createConstElevationDEM(1500, tileSize);

        const simulateWheel = (_map) => {
            const actual = [];
            for (const delta of deltas) {
                simulate.wheel(_map.getCanvas(), {type: 'wheel', deltaY: delta});
                _map._renderTaskQueue.run();
                actual.push(_map.getZoom());
            }
            return actual;
        };

        test('Scroll zoom on zero elevation', async () => {
            const map = createMap({
                interactive: true
            });
            await waitFor(map, "style.load");
            map.transform.zoom = 10;
            setMockElevationTerrain(map, zeroElevationDem, tileSize);
            await waitFor(map, "render");
            expect(map.painter.terrain.getAtPoint(new MercatorCoordinate(0.5, 0.5))).toEqual(0);
            expect(simulateWheel(map).map(v => fixedNum(v, 5))).toEqual(expected);
            map.remove();
        });

        test('Scroll zoom on high elevation', async () => {
            const map = createMap({
                interactive: true
            });
            await waitFor(map, "style.load");
            map.transform.zoom = 10;
            setMockElevationTerrain(map, highElevationDem, tileSize);
            await waitFor(map, "render");
            expect(map.painter.terrain.getAtPoint(new MercatorCoordinate(0.5, 0.5))).toEqual(1500);
            expect(simulateWheel(map).map(v => fixedNum(v, 5))).toEqual(expected);
            map.remove();
        });

        test('No movement when zoom is constrained', async () => {
            const map = createMap({
                interactive: true
            });
            await waitFor(map, "style.load");
            map.transform.zoom = 0;
            setMockElevationTerrain(map, zeroElevationDem, tileSize);
            await waitFor(map, "render");
            // zoom out to reach min zoom.
            for (let i = 0; i < 2; i++) {
                simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: 100});
                map._renderTaskQueue.run();
            }
            const tr = map.transform.clone();
            // zooming out further should keep the map center stabile.
            for (let i = 0; i < 5; i++) {
                simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: 0.0001});
                map._renderTaskQueue.run();
                simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: 100});
                map._renderTaskQueue.run();
            }
            expect(tr.center.lng.toFixed(10)).toEqual(map.transform.center.lng.toFixed(10));
            expect(tr.center.lat.toFixed(10)).toEqual(map.transform.center.lat.toFixed(10));
            map.remove();
        });

        test('Should keep maxZoom level during pitch', async () => {
            vi.useFakeTimers();

            const map = createMap({
                interactive: true,
                maxZoom: 12,
                zoom: 11,
                pitch: 60,
            });

            await waitFor(map, "style.load");

            setMockElevationTerrain(map, zeroElevationDem, tileSize);

            await waitFor(map, "render");

            for (let i = 0; i < 10; i++) {
                simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -100});
                map._renderTaskQueue.run();
            }

            equalWithPrecision(map.transform.zoom, 12, 0.001);

            map.remove();
        });

        test('Consistent deltas if elevation changes', async () => {
            const map = createMap({
                interactive: true
            });
            await waitFor(map, "style.load");
            map.transform.zoom = 10;

            // Setup the map with high elevation dem data
            setMockElevationTerrain(map, highElevationDem, tileSize);

            await waitFor(map, "render");
            expect(map.painter.terrain.getAtPoint(new MercatorCoordinate(0.5, 0.5))).toEqual(1500);

            // Start the scroll gesture with high elevation data by performing few scroll events
            simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: simulate.magicWheelZoomDelta});
            simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: 200});
            simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: 200});
            map._renderTaskQueue.run();

            // Simulate the switching of DEM tiles (due to LOD perhaps) to low elevation dems
            const tiles = map.style.getOwnSourceCache('mapbox-dem')._tiles;
            for (const tile in tiles)
                tiles[tile].dem = zeroElevationDem;

            // Let easing function to modify the zoom
            let prevZoom = map.getZoom();
            let thisZoom;
            const deltas = [];

            while (prevZoom !== thisZoom) {
                now++;
                prevZoom = map.getZoom();
                map._renderTaskQueue.run();
                thisZoom = map.getZoom();

                deltas.push(thisZoom - prevZoom);
            }

            // Direction of the zoom should not change, ie. sign of deltas is always negative
            expect(deltas.find(d => d > 0)).toBeFalsy();

            map.remove();
        });
    });

    describe('Globe', () => {
        test('Zoom towards a point on the globe', () => {
            const map = createMap({
                interactive: true
            });

            // Scroll zoom should result in identical movement in both mercator and globe projections
            map.transform.zoom = 0;

            for (let i = 0; i < 5; i++) {
                simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -100});
                map._renderTaskQueue.run();
            }

            expect(fixedNum(map.transform.zoom, 5)).toEqual(2.46106);

            now += 500;
            map.transform.zoom = 0;
            map.setProjection({name:'globe'});

            for (let i = 0; i < 5; i++) {
                simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -100});
                map._renderTaskQueue.run();
            }

            expect(fixedNum(map.transform.zoom, 5)).toEqual(2.46106);

            map.remove();
        });
    });

    test('Wheel events can cross antimeridian in projections that allow wrapping', () => {
        const map = createMap({
            interactive: true
        });
        map.setCenter([-178.90, 38.8888]);

        for (let i = 0; i < 2; i++) {
            simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
            map._renderTaskQueue.run();
        }

        expect(map.getCenter().lng).toEqual(178.36987154988992);

        map.remove();
    });

    test('Gracefully ignores wheel events with deltaY: 0', () => {
        const map = createMap({
            interactive: true
        });
        map._renderTaskQueue.run();

        const startZoom = map.getZoom();
        // simulate  shift+'wheel' events
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -0, shiftKey: true});
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -0, shiftKey: true});
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -0, shiftKey: true});
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -0, shiftKey: true});
        map._renderTaskQueue.run();

        now += 400;
        map._renderTaskQueue.run();

        expect(map.getZoom() - startZoom).toEqual(0.0);
    });

    test('Gracefully handle wheel events that cancel each other out before the first scroll frame', () => {
        // See also https://github.com/mapbox/mapbox-gl-js/issues/6782
        const map = createMap({
            interactive: true
        });
        map._renderTaskQueue.run();

        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -1});
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -1});
        now += 1;
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: 2});

        map._renderTaskQueue.run();

        now += 400;
        map._renderTaskQueue.run();
    });

    test('does not zoom if preventDefault is called on the wheel event', async () => {
        const map = createMap({
            interactive: true
        });

        map.once('wheel', (e) => {
            e.preventDefault();
        });
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();
        now += 400;

        map._renderTaskQueue.run();

        expect(map.getZoom()).toEqual(0);
        map.remove();
    });

    /**
     * @note Flacky
     */
    test.skip('emits one movestart event and one moveend event while zooming', async () => {
        vi.useFakeTimers(now);
        const map = createMap({
            interactive: true
        });

        let startCount = 0;
        map.on('movestart', () => {
            startCount += 1;
        });

        let endCount = 0;
        map.on('moveend', () => {
            endCount += 1;
        });

        const events = [
            [2, {type: 'trackpad', deltaY: -1}],
            [7, {type: 'trackpad', deltaY: -2}],
            [30, {type: 'wheel', deltaY: -5}]
        ];

        const end = now + 50;
        let lastWheelEvent = now;

        while (now++ < end) {
            if (events.length && lastWheelEvent + events[0][0] === now) {
                const [, event] = events.shift();
                simulate.wheel(map.getCanvas(), event);
                lastWheelEvent = now;
            }
            if (now % 20 === 0) {
                map._renderTaskQueue.run();
            }
        }

        vi.advanceTimersByTime(200);

        map._renderTaskQueue.run();

        expect(startCount).toEqual(1);
        expect(endCount).toEqual(1);
    });

    /**
     * @note Flacky
     */
    test.skip('emits one zoomstart event and one zoomend event while zooming', async () => {
        vi.useFakeTimers(now);
        const map = createMap({
            interactive: true
        });

        let startCount = 0;
        map.on('zoomstart', () => {
            startCount += 1;
        });

        let endCount = 0;
        map.on('zoomend', () => {
            endCount += 1;
        });

        const events = [
            [2, {type: 'trackpad', deltaY: -1}],
            [7, {type: 'trackpad', deltaY: -2}],
            [30, {type: 'wheel', deltaY: -5}],
        ];

        const end = now + 50;
        let lastWheelEvent = now;

        while (now++ < end) {
            if (events.length && lastWheelEvent + events[0][0] === now) {
                const [, event] = events.shift();
                simulate.wheel(map.getCanvas(), event);
                lastWheelEvent = now;
            }
            if (now % 20 === 0) {
                map._renderTaskQueue.run();
            }
        }

        vi.advanceTimersByTime(200);
        map._renderTaskQueue.run();

        expect(startCount).toEqual(1);
        expect(endCount).toEqual(1);

        await waitFor(map, 'idle');
    });
});

test('When cooperativeGestures option is set to true, a .mapboxgl-scroll-zoom-blocker element is added to map', () => {
    const map = createMapWithCooperativeGestures();

    expect(map.getContainer().querySelectorAll('.mapboxgl-scroll-zoom-blocker').length).toEqual(1);
});

test('When cooperativeGestures option is set to true, scroll zoom is prevented when the ctrl key or meta key is not pressed during wheel event', () => {
    const map = createMapWithCooperativeGestures();

    const zoomSpy = vi.fn();
    map.on('zoom', zoomSpy);

    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});

    expect(zoomSpy).not.toHaveBeenCalled(0);
});

test('When cooperativeGestures option is set to true, scroll zoom is activated when ctrl key is pressed during wheel event', () => {
    const map = createMapWithCooperativeGestures();

    const zoomSpy = vi.fn();
    map.on('zoom', zoomSpy);

    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta, ctrlKey: true});

    map._renderTaskQueue.run();

    expect(zoomSpy).toHaveBeenCalledTimes(1);
});

test('When cooperativeGestures option is set to true, scroll zoom is activated when meta key is pressed during wheel event', () => {
    const map = createMapWithCooperativeGestures();

    const zoomSpy = vi.fn();
    map.on('zoom', zoomSpy);

    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta, metaKey: true});

    map._renderTaskQueue.run();

    expect(zoomSpy).toHaveBeenCalledTimes(1);
});

test('When cooperativeGestures is true and map is in fullscreen, scroll zoom is not prevented', () => {
    vi.spyOn(window.document, 'fullscreenElement', 'get').mockImplementation(() => true);
    const map = createMapWithCooperativeGestures();

    const zoomSpy = vi.fn();
    map.on('zoom', zoomSpy);

    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
    map._renderTaskQueue.run();

    expect(zoomSpy).toHaveBeenCalledTimes(1);
});

test('Disabling scrollZoom removes scroll zoom blocker container', () => {
    const map = createMapWithCooperativeGestures();

    map.scrollZoom.disable();

    expect(map.getContainer().querySelectorAll('.mapboxgl-scroll-zoom-blocker').length).toEqual(0);
});
