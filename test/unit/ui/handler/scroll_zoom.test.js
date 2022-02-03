import {test} from '../../../util/test.js';
import browser from '../../../../src/util/browser.js';
import window from '../../../../src/util/window.js';
import Map from '../../../../src/ui/map.js';
import DOM from '../../../../src/util/dom.js';
import simulate from '../../../util/simulate_interaction.js';
import {equalWithPrecision} from '../../../util/index.js';
import sinon from 'sinon';
import {createConstElevationDEM, setMockElevationTerrain} from '../../../util/dem_mock.js';
import {fixedNum} from '../../../util/fixed.js';
import MercatorCoordinate from '../../../../src/geo/mercator_coordinate.js';

function createMap(t) {
    t.stub(Map.prototype, '_detectMissingCSS');
    t.stub(Map.prototype, '_authenticate');
    return new Map({
        container: DOM.create('div', '', window.document.body),
        testMode: true,
        style: {
            "version": 8,
            "sources": {},
            "layers": []
        }
    });
}

function createMapWithCooperativeGestures(t) {
    t.stub(Map.prototype, '_detectMissingCSS');
    t.stub(Map.prototype, '_authenticate');
    return new Map({
        container: DOM.create('div', '', window.document.body),
        cooperativeGestures: true
    });
}

test('ScrollZoomHandler', (t) => {
    const browserNow = t.stub(browser, 'now');
    let now = 1555555555555;
    browserNow.callsFake(() => now);

    t.test('Zooms for single mouse wheel tick', (t) => {
        const map = createMap(t);
        map._renderTaskQueue.run();

        // simulate a single 'wheel' event
        const startZoom = map.getZoom();

        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();

        now += 400;
        map._renderTaskQueue.run();

        equalWithPrecision(t, map.getZoom() - startZoom,  0.0285, 0.001);

        map.remove();
        t.end();
    });

    t.test('Zooms for single mouse wheel tick with non-magical deltaY', (t) => {
        const map = createMap(t);
        map._renderTaskQueue.run();

        // Simulate a single 'wheel' event without the magical deltaY value.
        // This requires the handler to briefly wait to see if a subsequent
        // event is coming in order to guess trackpad vs. mouse wheel
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -20});
        map.on('zoomstart', () => {
            map.remove();
            t.end();
        });
    });

    t.test('Zooms for multiple mouse wheel ticks', (t) => {
        const map = createMap(t);

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
        equalWithPrecision(t, map.getZoom() - startZoom,  1.944, 0.001);

        map.remove();
        t.end();
    });

    t.test('Terrain', (t) => {
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

        t.test('Scroll zoom on zero elevation', (t) => {
            const map = createMap(t);
            map.on('style.load', () => {
                map.transform.zoom = 10;
                setMockElevationTerrain(map, zeroElevationDem, tileSize);
                map.once('render', () => {
                    t.equal(map.painter.terrain.getAtPoint(new MercatorCoordinate(0.5, 0.5)), 0);
                    t.deepEqual(simulateWheel(map).map(v => fixedNum(v, 5)), expected);
                    map.remove();
                    t.end();
                });
            });
        });

        t.test('Scroll zoom on high elevation', (t) => {
            const map = createMap(t);
            map.on('style.load', () => {
                map.transform.zoom = 10;
                setMockElevationTerrain(map, highElevationDem, tileSize);
                map.once('render', () => {
                    t.equal(map.painter.terrain.getAtPoint(new MercatorCoordinate(0.5, 0.5)), 1500);
                    t.deepEqual(simulateWheel(map).map(v => fixedNum(v, 5)), expected);
                    map.remove();
                    t.end();
                });
            });
        });

        t.test('No movement when zoom is constrained', (t) => {
            const map = createMap(t);
            map.on('style.load', () => {
                map.transform.zoom = 0;
                setMockElevationTerrain(map, zeroElevationDem, tileSize);
                map.once('render', () => {
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
                    t.equal(tr.center.lng.toFixed(10), map.transform.center.lng.toFixed(10));
                    t.equal(tr.center.lat.toFixed(10), map.transform.center.lat.toFixed(10));
                    map.remove();
                    t.end();
                });
            });
        });

        t.test('Consistent deltas if elevation changes', (t) => {
            const map = createMap(t);
            map.on('style.load', () => {
                map.transform.zoom = 10;

                // Setup the map with high elevation dem data
                setMockElevationTerrain(map, highElevationDem, tileSize);

                map.once('render', () => {
                    t.equal(map.painter.terrain.getAtPoint(new MercatorCoordinate(0.5, 0.5)), 1500);

                    // Start the scroll gesture with high elevation data by performing few scroll events
                    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: simulate.magicWheelZoomDelta});
                    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: 200});
                    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: 200});
                    map._renderTaskQueue.run();

                    // Simulate the switching of DEM tiles (due to LOD perhaps) to low elevation dems
                    const tiles = map.style._getSourceCache('mapbox-dem')._tiles;
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
                    t.false(deltas.find(d => d > 0));

                    map.remove();
                    t.end();
                });
            });
        });
        t.end();
    });

    t.test('Gracefully ignores wheel events with deltaY: 0', (t) => {
        const map = createMap(t);
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

        t.equal(map.getZoom() - startZoom, 0.0);

        t.end();
    });

    t.test('Gracefully handle wheel events that cancel each other out before the first scroll frame', (t) => {
        // See also https://github.com/mapbox/mapbox-gl-js/issues/6782
        const map = createMap(t);
        map._renderTaskQueue.run();

        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -1});
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -1});
        now += 1;
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: 2});

        map._renderTaskQueue.run();

        now += 400;
        map._renderTaskQueue.run();

        t.end();
    });

    t.test('does not zoom if preventDefault is called on the wheel event', (t) => {
        const map = createMap(t);

        map.on('wheel', e => e.preventDefault());

        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();

        now += 400;
        map._renderTaskQueue.run();

        t.equal(map.getZoom(), 0);

        map.remove();
        t.end();
    });

    t.test('emits one movestart event and one moveend event while zooming', (t) => {
        const clock = sinon.useFakeTimers(now);
        const map = createMap(t);

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

        clock.tick(200);

        map._renderTaskQueue.run();

        t.equal(startCount, 1);
        t.equal(endCount, 1);

        clock.restore();

        t.end();
    });

    t.test('emits one zoomstart event and one zoomend event while zooming', (t) => {
        const clock = sinon.useFakeTimers(now);
        const map = createMap(t);

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

        clock.tick(200);
        map._renderTaskQueue.run();

        t.equal(startCount, 1);
        t.equal(endCount, 1);

        clock.restore();

        t.end();
    });

    t.end();
});

test('When cooperativeGestures option is set to true, a .mapboxgl-scroll-zoom-blocker element is added to map', (t) => {
    const map = createMapWithCooperativeGestures(t);

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-scroll-zoom-blocker').length, 1);
    t.end();
});

test('When cooperativeGestures option is set to true, scroll zoom is prevented when the ctrl key or meta key is not pressed during wheel event', (t) => {
    const map = createMapWithCooperativeGestures(t);

    const zoomSpy = t.spy();
    map.on('zoom', zoomSpy);

    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});

    t.equal(zoomSpy.callCount, 0);
    t.end();
});

test('When cooperativeGestures option is set to true, scroll zoom is activated when ctrl key is pressed during wheel event', (t) => {
    const map = createMapWithCooperativeGestures(t);

    const zoomSpy = t.spy();
    map.on('zoom', zoomSpy);

    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta, ctrlKey: true});

    map._renderTaskQueue.run();

    t.equal(zoomSpy.callCount, 1);
    t.end();
});

test('When cooperativeGestures option is set to true, scroll zoom is activated when meta key is pressed during wheel event', (t) => {
    const map = createMapWithCooperativeGestures(t);

    const zoomSpy = t.spy();
    map.on('zoom', zoomSpy);

    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta, metaKey: true});

    map._renderTaskQueue.run();

    t.equal(zoomSpy.callCount, 1);
    t.end();
});

test('Disabling scrollZoom removes scroll zoom blocker container', (t) => {
    const map = createMapWithCooperativeGestures(t);

    map.scrollZoom.disable();

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-scroll-zoom-blocker').length, 0);
    t.end();
});
