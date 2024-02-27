import {describe, test, expect, vi, afterEach, equalWithPrecision} from "../../util/vitest.js";
import {vec3, quat} from 'gl-matrix';
import Camera from '../../../src/ui/camera.js';
import {FreeCameraOptions} from '../../../src/ui/free_camera.js';
import Transform from '../../../src/geo/transform.js';
import TaskQueue from '../../../src/util/task_queue.js';
import browser from '../../../src/util/browser.js';
import {fixedLngLat, fixedNum, fixedVec3} from '../../util/fixed.js';
import MercatorCoordinate from '../../../src/geo/mercator_coordinate.js';
import LngLat from '../../../src/geo/lng_lat.js';
import LngLatBounds from '../../../src/geo/lng_lat_bounds.js';

describe('camera', () => {
    function attachSimulateFrame(camera) {
        const queue = new TaskQueue();
        camera._requestRenderFrame = (cb) => queue.add(cb);
        camera._cancelRenderFrame = (id) => queue.remove(id);
        camera.simulateFrame = () => queue.run();
        return camera;
    }

    function createCamera(options) {
        options = options || {};

        const transform = new Transform(0, 20, 0, 85, options.renderWorldCopies, options.projection);
        transform.resize(512, 512);

        const camera = attachSimulateFrame(new Camera(transform, options))
            .jumpTo(options);

        camera._update = () => {};
        camera._preloadTiles = () => {};

        return camera;
    }

    async function assertTransitionTime(camera, min, max, action) {
        let startTime;
        await new Promise(resolve => {
            camera
                .on('movestart', () => { startTime = browser.now(); })
                .on('moveend', () => {
                    const endTime = browser.now();
                    const timeDiff = endTime - startTime;
                    expect(timeDiff >= min && timeDiff < max).toBeTruthy();
                    resolve();
                });
            action();
        });
    }

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('#jumpTo', () => {
        // Choose initial zoom to avoid center being constrained by mercator latitude limits.
        const camera = createCamera({zoom: 1});

        test('sets center', () => {
            camera.jumpTo({center: [1, 2]});
            expect(camera.getCenter()).toEqual({lng: 1, lat: 2});
        });

        test('throws on invalid center argument', () => {
            expect(() => {
                camera.jumpTo({center: 1});
            }).toThrowError(Error);
        });

        test('keeps current center if not specified', () => {
            camera.jumpTo({});
            expect(camera.getCenter()).toEqual({lng: 1, lat: 2});
        });

        test('sets zoom', () => {
            camera.jumpTo({zoom: 3});
            expect(camera.getZoom()).toEqual(3);
        });

        test('keeps current zoom if not specified', () => {
            camera.jumpTo({});
            expect(camera.getZoom()).toEqual(3);
        });

        test('sets bearing', () => {
            camera.jumpTo({bearing: 4});
            expect(camera.getBearing()).toEqual(4);
        });

        test('keeps current bearing if not specified', () => {
            camera.jumpTo({});
            expect(camera.getBearing()).toEqual(4);
        });

        test('sets pitch', () => {
            camera.jumpTo({pitch: 45});
            expect(camera.getPitch()).toEqual(45);
        });

        test('keeps current pitch if not specified', () => {
            camera.jumpTo({});
            expect(camera.getPitch()).toEqual(45);
        });

        test('sets multiple properties', () => {
            camera.jumpTo({
                center: [10, 20],
                zoom: 10,
                bearing: 180,
                pitch: 60
            });
            expect(camera.getCenter()).toEqual({lng: 10, lat: 20});
            expect(camera.getZoom()).toEqual(10);
            expect(camera.getBearing()).toEqual(180);
            expect(camera.getPitch()).toEqual(60);
        });

        test('emits move events, preserving eventData', async () => {
            let started, moved, ended;
            const eventData = {data: 'ok'};

            camera
                .on('movestart', (d) => { started = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => { ended = d.data; });

            camera.jumpTo({center: [1, 2]}, eventData);
            expect(started).toEqual('ok');
            expect(moved).toEqual('ok');
            expect(ended).toEqual('ok');
        });

        test('emits zoom events, preserving eventData', async () => {
            let started, zoomed, ended;
            const eventData = {data: 'ok'};

            camera
                .on('zoomstart', (d) => { started = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomend', (d) => { ended = d.data; });

            camera.jumpTo({zoom: 3}, eventData);
            expect(started).toEqual('ok');
            expect(zoomed).toEqual('ok');
            expect(ended).toEqual('ok');
        });

        test('emits rotate events, preserving eventData', async () => {
            let started, rotated, ended;
            const eventData = {data: 'ok'};

            camera
                .on('rotatestart', (d) => { started = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('rotateend', (d) => { ended = d.data; });

            camera.jumpTo({bearing: 90}, eventData);
            expect(started).toEqual('ok');
            expect(rotated).toEqual('ok');
            expect(ended).toEqual('ok');
        });

        test('emits pitch events, preserving eventData', async () => {
            let started, pitched, ended;
            const eventData = {data: 'ok'};

            camera
                .on('pitchstart', (d) => { started = d.data; })
                .on('pitch', (d) => { pitched = d.data; })
                .on('pitchend', (d) => { ended = d.data; });

            camera.jumpTo({pitch: 10}, eventData);
            expect(started).toEqual('ok');
            expect(pitched).toEqual('ok');
            expect(ended).toEqual('ok');
        });

        test('cancels in-progress easing', () => {
            camera.panTo([3, 4]);
            expect(camera.isEasing()).toBeTruthy();
            camera.jumpTo({center: [1, 2]});
            expect(!camera.isEasing()).toBeTruthy();
        });
    });

    describe('#setCenter', () => {
        // Choose initial zoom to avoid center being constrained by mercator latitude limits.
        const camera = createCamera({zoom: 1});

        test('sets center', () => {
            camera.setCenter([1, 2]);
            expect(camera.getCenter()).toEqual({lng: 1, lat: 2});
        });

        test('throws on invalid center argument', () => {
            expect(() => {
                camera.jumpTo({center: 1});
            }).toThrowError(Error);
        });

        test('emits move events, preserving eventData', async () => {
            let started, moved, ended;
            const eventData = {data: 'ok'};

            camera.on('movestart', (d) => { started = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => { ended = d.data; });

            camera.setCenter([10, 20], eventData);
            expect(started).toEqual('ok');
            expect(moved).toEqual('ok');
            expect(ended).toEqual('ok');
        });

        test('cancels in-progress easing', () => {
            camera.panTo([3, 4]);
            expect(camera.isEasing()).toBeTruthy();
            camera.setCenter([1, 2]);
            expect(!camera.isEasing()).toBeTruthy();
        });
    });

    describe('#setZoom', () => {
        const camera = createCamera();

        test('sets zoom', () => {
            camera.setZoom(3);
            expect(camera.getZoom()).toEqual(3);
        });

        test('emits move and zoom events, preserving eventData', async () => {
            let movestarted, moved, moveended, zoomstarted, zoomed, zoomended;
            const eventData = {data: 'ok'};

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => { moveended = d.data; })
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomend', (d) => { zoomended = d.data; });

            camera.setZoom(4, eventData);
            expect(movestarted).toEqual('ok');
            expect(moved).toEqual('ok');
            expect(moveended).toEqual('ok');
            expect(zoomstarted).toEqual('ok');
            expect(zoomed).toEqual('ok');
            expect(zoomended).toEqual('ok');
        });

        test('cancels in-progress easing', () => {
            camera.panTo([3, 4]);
            expect(camera.isEasing()).toBeTruthy();
            camera.setZoom(5);
            expect(!camera.isEasing()).toBeTruthy();
        });
    });

    describe('#setBearing', () => {
        const camera = createCamera();

        test('sets bearing', () => {
            camera.setBearing(4);
            expect(camera.getBearing()).toEqual(4);
        });

        test('emits move and rotate events, preserving eventData', async () => {
            let movestarted, moved, moveended, rotatestarted, rotated, rotateended;
            const eventData = {data: 'ok'};

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => { moveended = d.data; })
                .on('rotatestart', (d) => { rotatestarted = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('rotateend', (d) => { rotateended = d.data; });

            camera.setBearing(5, eventData);
            expect(movestarted).toEqual('ok');
            expect(moved).toEqual('ok');
            expect(moveended).toEqual('ok');
            expect(rotatestarted).toEqual('ok');
            expect(rotated).toEqual('ok');
            expect(rotateended).toEqual('ok');
        });

        test('cancels in-progress easing', () => {
            camera.panTo([3, 4]);
            expect(camera.isEasing()).toBeTruthy();
            camera.setBearing(6);
            expect(!camera.isEasing()).toBeTruthy();
        });
    });

    describe('#setPadding', () => {
        test('sets padding', () => {
            const camera = createCamera();
            const padding = {left: 300, top: 100, right: 50, bottom: 10};
            camera.setPadding(padding);
            expect(camera.getPadding()).toEqual(padding);
        });

        test('existing padding is retained if no new values are passed in', () => {
            const camera = createCamera();
            const padding = {left: 300, top: 100, right: 50, bottom: 10};
            camera.setPadding(padding);
            camera.setPadding({});

            const currentPadding = camera.getPadding();
            expect(currentPadding).toEqual(padding);
        });

        test(
            'doesnt change padding thats already present if new value isnt passed in',
            () => {
                const camera = createCamera();
                const padding = {left: 300, top: 100, right: 50, bottom: 10};
                camera.setPadding(padding);
                const padding1 = {right: 100};
                camera.setPadding(padding1);

                const currentPadding = camera.getPadding();
                expect(currentPadding.left).toEqual(padding.left);
                expect(currentPadding.top).toEqual(padding.top);
                // padding1 here
                expect(currentPadding.right).toEqual(padding1.right);
                expect(currentPadding.bottom).toEqual(padding.bottom);
            }
        );
    });

    describe('#panBy', () => {
        test('pans by specified amount', () => {
            const camera = createCamera();
            camera.panBy([100, 0], {duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 70.3125, lat: 0});
        });

        test('pans relative to viewport on a rotated camera', () => {
            const camera = createCamera({bearing: 180});
            camera.panBy([100, 0], {duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: -70.3125, lat: 0});
        });

        test('pans equally in both directions', () => {
            const camera = createCamera({bearing: 0});
            const c = camera.getCenter();
            camera.panBy([0, -10000], {duration: 0});
            const c1 = camera.getCenter();
            camera.panBy([0, 10000], {duration: 0});
            const c2 = camera.getCenter();
            expect(Math.abs(c1.lat - c.lat) - Math.abs(c2.lat - c.lat) < 1e-10).toBeTruthy();
        });

        test('emits move events, preserving eventData', async () => {
            const camera = createCamera();
            let started, moved;
            const eventData = {data: 'ok'};

            camera
                .on('movestart', (d) => { started = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => {
                    expect(started).toEqual('ok');
                    expect(moved).toEqual('ok');
                    expect(d.data).toEqual('ok');
                });

            camera.panBy([100, 0], {duration: 0}, eventData);
        });

        test('supresses movestart if noMoveStart option is true', async () => {
            const camera = createCamera();
            let started;

            // fire once in advance to satisfy assertions that moveend only comes after movestart
            camera.fire('movestart');

            camera
                .on('movestart', () => { started = true; })
                .on('moveend', () => {
                    expect(!started).toBeTruthy();
                });

            camera.panBy([100, 0], {duration: 0, noMoveStart: true});
        });
    });

    describe('#panTo', () => {
        test('pans to specified location', () => {
            const camera = createCamera();
            camera.panTo([100, 0], {duration: 0});
            expect(camera.getCenter()).toEqual({lng: 100, lat: 0});
        });

        test('throws on invalid center argument', () => {
            const camera = createCamera();
            expect(() => {
                camera.panTo({center: 1});
            }).toThrowError(Error);
        });

        test('pans with specified offset', () => {
            const camera = createCamera();
            camera.panTo([100, 0], {offset: [100, 0], duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 29.6875, lat: 0});
        });

        test(
            'pans with specified offset relative to viewport on a rotated camera',
            () => {
                const camera = createCamera({bearing: 180});
                camera.panTo([100, 0], {offset: [100, 0], duration: 0});
                expect(fixedLngLat(camera.getCenter())).toEqual({lng: 170.3125, lat: 0});
            }
        );

        test('emits move events, preserving eventData', async () => {
            const camera = createCamera();
            let started, moved;
            const eventData = {data: 'ok'};

            camera
                .on('movestart', (d) => { started = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => {
                    expect(started).toEqual('ok');
                    expect(moved).toEqual('ok');
                    expect(d.data).toEqual('ok');
                });

            camera.panTo([100, 0], {duration: 0}, eventData);
        });

        test('supresses movestart if noMoveStart option is true', async () => {
            const camera = createCamera();
            let started;

            // fire once in advance to satisfy assertions that moveend only comes after movestart
            camera.fire('movestart');

            camera
                .on('movestart', () => { started = true; })
                .on('moveend', () => {
                    expect(!started).toBeTruthy();
                });

            camera.panTo([100, 0], {duration: 0, noMoveStart: true});
        });
    });

    describe('#zoomTo', () => {
        test('zooms to specified level', () => {
            const camera = createCamera();
            camera.zoomTo(3.2, {duration: 0});
            expect(camera.getZoom()).toEqual(3.2);
        });

        test('zooms around specified location', () => {
            const camera = createCamera();
            camera.zoomTo(3.2, {around: [5, 0], duration: 0});
            expect(camera.getZoom()).toEqual(3.2);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 4.455905898, lat: 0}));
        });

        test('zooms with specified offset', () => {
            const camera = createCamera();
            camera.zoomTo(3.2, {offset: [100, 0], duration: 0});
            expect(camera.getZoom()).toEqual(3.2);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 62.66117668978015, lat: 0}));
        });

        test(
            'zooms with specified offset relative to viewport on a rotated camera',
            () => {
                const camera = createCamera({bearing: 180});
                camera.zoomTo(3.2, {offset: [100, 0], duration: 0});
                expect(camera.getZoom()).toEqual(3.2);
                expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: -62.66117668978012, lat: 0}));
            }
        );

        test('emits move and zoom events, preserving eventData', async () => {
            const camera = createCamera();
            let movestarted, moved, zoomstarted, zoomed;
            const eventData = {data: 'ok'};

            const movePromise = new Promise(resolve => {
                camera
                    .on('movestart', (d) => { movestarted = d.data; })
                    .on('move', (d) => { moved = d.data; })
                    .on('moveend', (d) => {
                        expect(movestarted).toEqual('ok');
                        expect(moved).toEqual('ok');
                        expect(d.data).toEqual('ok');
                        resolve();
                    });
            });

            const zoomPromise = new Promise(resolve => {
                camera
                    .on('zoomstart', (d) => { zoomstarted = d.data; })
                    .on('zoom', (d) => { zoomed = d.data; })
                    .on('zoomend', (d) => {
                        expect(zoomstarted).toEqual('ok');
                        expect(zoomed).toEqual('ok');
                        expect(d.data).toEqual('ok');
                        resolve();
                    });
            });

            await Promise.all([
                movePromise,
                zoomPromise,
                Promise.resolve(camera.zoomTo(5, {duration: 0}, eventData))
            ]);

        });
    });

    describe('#rotateTo', () => {
        test('rotates to specified bearing', () => {
            const camera = createCamera();
            camera.rotateTo(90, {duration: 0});
            expect(camera.getBearing()).toEqual(90);
        });

        test('rotates around specified location', () => {
            const camera = createCamera({zoom: 3});
            camera.rotateTo(90, {around: [5, 0], duration: 0});
            expect(camera.getBearing()).toEqual(90);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 5, lat: 4.993665859}));
        });

        test('rotates around specified location, constrained to fit the view', () => {
            const camera = createCamera({zoom: 0});
            camera.rotateTo(90, {around: [5, 0], duration: 0});
            expect(camera.getBearing()).toEqual(90);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 4.999999999999972, lat: 0.000002552471840999715}));
        });

        test('rotates with specified offset', () => {
            const camera = createCamera({zoom: 1});
            camera.rotateTo(90, {offset: [200, 0], duration: 0});
            expect(camera.getBearing()).toEqual(90);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 70.3125, lat: 57.3265212252}));
        });

        test('rotates with specified offset, constrained to fit the view', () => {
            const camera = createCamera({zoom: 0});
            camera.rotateTo(90, {offset: [100, 0], duration: 0});
            expect(camera.getBearing()).toEqual(90);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 70.3125, lat: 0.000002552471840999715}));
        });

        test(
            'rotates with specified offset relative to viewport on a rotated camera',
            () => {
                const camera = createCamera({bearing: 180, zoom: 1});
                camera.rotateTo(90, {offset: [200, 0], duration: 0});
                expect(camera.getBearing()).toEqual(90);
                expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: -70.3125, lat: 57.3265212252}));
            }
        );

        test('emits move and rotate events, preserving eventData', async () => {
            const camera = createCamera();
            let movestarted, moved, rotatestarted, rotated;
            const eventData = {data: 'ok'};

            const movePromise = new Promise(resolve => {
                camera
                    .on('movestart', (d) => { movestarted = d.data; })
                    .on('move', (d) => { moved = d.data; })
                    .on('moveend', (d) => {
                        expect(movestarted).toEqual('ok');
                        expect(moved).toEqual('ok');
                        expect(d.data).toEqual('ok');
                        resolve();
                    });
            });

            const rotatePromise = new Promise(resolve => {
                camera
                    .on('rotatestart', (d) => { rotatestarted = d.data; })
                    .on('rotate', (d) => { rotated = d.data; })
                    .on('rotateend', (d) => {
                        expect(rotatestarted).toEqual('ok');
                        expect(rotated).toEqual('ok');
                        expect(d.data).toEqual('ok');
                        resolve();
                    });
            });

            await Promise.all([
                movePromise,
                rotatePromise,
                camera.rotateTo(90, {duration: 0}, eventData)
            ]);
        });
    });

    describe('#easeTo', () => {
        test('pans to specified location', () => {
            const camera = createCamera();
            camera.easeTo({center: [100, 0], duration: 0});
            expect(camera.getCenter()).toEqual({lng: 100, lat: 0});
        });

        test('zooms to specified level', () => {
            const camera = createCamera();
            camera.easeTo({zoom: 3.2, duration: 0});
            expect(camera.getZoom()).toEqual(3.2);
        });

        test('rotates to specified bearing', () => {
            const camera = createCamera();
            camera.easeTo({bearing: 90, duration: 0});
            expect(camera.getBearing()).toEqual(90);
        });

        test('pitches to specified pitch', () => {
            const camera = createCamera();
            camera.easeTo({pitch: 45, duration: 0});
            expect(camera.getPitch()).toEqual(45);
        });

        test('pans and zooms', () => {
            const camera = createCamera();
            camera.easeTo({center: [100, 0], zoom: 3.2, duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 100, lat: 0}));
            expect(camera.getZoom()).toEqual(3.2);
        });

        test('zooms around a point', () => {
            const camera = createCamera();
            camera.easeTo({around: [100, 0], zoom: 3, duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 87.5, lat: 0}));
            expect(camera.getZoom()).toEqual(3);
        });

        test('pans and rotates', () => {
            const camera = createCamera();
            camera.easeTo({center: [100, 0], bearing: 90, duration: 0});
            expect(camera.getCenter()).toEqual({lng: 100, lat: 0});
            expect(camera.getBearing()).toEqual(90);
        });

        test('zooms and rotates', () => {
            const camera = createCamera();
            camera.easeTo({zoom: 3.2, bearing: 90, duration: 0});
            expect(camera.getZoom()).toEqual(3.2);
            expect(camera.getBearing()).toEqual(90);
        });

        test('pans, zooms, and rotates', () => {
            const camera = createCamera({bearing: -90});
            camera.easeTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 100, lat: 0}));
            expect(camera.getZoom()).toEqual(3.2);
            expect(camera.getBearing()).toEqual(90);
        });

        test('noop', () => {
            const camera = createCamera();
            camera.easeTo({duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 0, lat: 0});
            expect(camera.getZoom()).toEqual(0);
            expect(camera.getBearing()).toEqual(0);
        });

        test('noop with offset', () => {
            const camera = createCamera();
            camera.easeTo({offset: [100, 0], duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 0, lat: 0});
            expect(camera.getZoom()).toEqual(0);
            expect(camera.getBearing()).toEqual(0);
        });

        test('pans with specified offset', () => {
            const camera = createCamera();
            camera.easeTo({center: [100, 0], offset: [100, 0], duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 29.6875, lat: 0});
        });

        test(
            'pans with specified offset relative to viewport on a rotated camera',
            () => {
                const camera = createCamera({bearing: 180});
                camera.easeTo({center: [100, 0], offset: [100, 0], duration: 0});
                expect(fixedLngLat(camera.getCenter())).toEqual({lng: 170.3125, lat: 0});
            }
        );

        test('zooms with specified offset', () => {
            const camera = createCamera();
            camera.easeTo({zoom: 3.2, offset: [100, 0], duration: 0});
            expect(camera.getZoom()).toEqual(3.2);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 62.66117668978015, lat: 0}));
        });

        test(
            'zooms with specified offset relative to viewport on a rotated camera',
            () => {
                const camera = createCamera({bearing: 180});
                camera.easeTo({zoom: 3.2, offset: [100, 0], duration: 0});
                expect(camera.getZoom()).toEqual(3.2);
                expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: -62.66117668978012, lat: 0}));
            }
        );

        test('rotates with specified offset', () => {
            const camera = createCamera();
            camera.easeTo({bearing: 90, offset: [100, 0], duration: 0});
            expect(camera.getBearing()).toEqual(90);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 70.3125, lat: 0.000002552471840999715}));
        });

        test(
            'rotates with specified offset relative to viewport on a rotated camera',
            () => {
                const camera = createCamera({bearing: 180});
                camera.easeTo({bearing: 90, offset: [100, 0], duration: 0});
                expect(camera.getBearing()).toEqual(90);
                expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: -70.3125, lat: 0.000002552471840999715}));
            }
        );

        test(
            'emits move, zoom, rotate, and pitch events, preserving eventData',
            async () => {
                const camera = createCamera();
                let movestarted, moved, zoomstarted, zoomed, rotatestarted, rotated, pitchstarted, pitched;
                const eventData = {data: 'ok'};

                const movePromise = new Promise(resolve => {
                    camera
                        .on('movestart', (d) => { movestarted = d.data; })
                        .on('move', (d) => { moved = d.data; })
                        .on('moveend', (d) => {
                            expect(camera._zooming).toBeFalsy();
                            expect(camera._panning).toBeFalsy();
                            expect(camera._rotating).toBeFalsy();

                            expect(movestarted).toEqual('ok');
                            expect(moved).toEqual('ok');
                            expect(zoomed).toEqual('ok');
                            expect(rotated).toEqual('ok');
                            expect(pitched).toEqual('ok');
                            expect(d.data).toEqual('ok');
                            resolve();
                        });
                });

                const zoomPromise = new Promise(resolve => {
                    camera
                        .on('zoomstart', (d) => { zoomstarted = d.data; })
                        .on('zoom', (d) => { zoomed = d.data; })
                        .on('zoomend', (d) => {
                            expect(zoomstarted).toEqual('ok');
                            expect(zoomed).toEqual('ok');
                            expect(d.data).toEqual('ok');
                            resolve();
                        });
                });

                const rotatePromise = new Promise(resolve => {
                    camera
                        .on('rotatestart', (d) => { rotatestarted = d.data; })
                        .on('rotate', (d) => { rotated = d.data; })
                        .on('rotateend', (d) => {
                            expect(rotatestarted).toEqual('ok');
                            expect(rotated).toEqual('ok');
                            expect(d.data).toEqual('ok');
                            resolve();
                        });
                });

                const pitchPromise = new Promise(resolve => {
                    camera
                        .on('pitchstart', (d) => { pitchstarted = d.data; })
                        .on('pitch', (d) => { pitched = d.data; })
                        .on('pitchend', (d) => {
                            expect(pitchstarted).toEqual('ok');
                            expect(pitched).toEqual('ok');
                            expect(d.data).toEqual('ok');
                            resolve();
                        });
                });

                await Promise.all([
                    movePromise,
                    zoomPromise,
                    rotatePromise,
                    pitchPromise,
                    camera.easeTo(
                        {center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, pitch: 45},
                        eventData
                    )
                ]);
            }
        );

        test('does not emit zoom events if not zooming', async () => {
            const camera = createCamera();

            camera
                .on('zoomstart', () => { expect.unreachable(); })
                .on('zoom', () => { expect.unreachable(); })
                .on('zoomend', () => { expect.unreachable(); })
                .on('moveend', () => {});

            camera.easeTo({center: [100, 0], duration: 0});
        });

        test('stops existing ease', () => {
            const camera = createCamera();
            camera.easeTo({center: [200, 0], duration: 100});
            camera.easeTo({center: [100, 0], duration: 0});
            expect(camera.getCenter()).toEqual({lng: 100, lat: 0});
        });

        test('can be called from within a moveend event handler', async () => {
            const camera = createCamera();
            const stub = vi.spyOn(browser, 'now').mockImplementation(() => 0);

            camera.easeTo({center: [100, 0], duration: 10});

            await new Promise(resolve => {
                camera.once('moveend', () => {
                    camera.easeTo({center: [200, 0], duration: 10});
                    camera.once('moveend', () => {
                        camera.easeTo({center: [300, 0], duration: 10});
                        camera.once('moveend', () => {
                            resolve();
                        });

                        setTimeout(() => {
                            stub.mockImplementation(() => 30);
                            camera.simulateFrame();
                        }, 0);
                    });

                    // setTimeout to avoid a synchronous callback
                    setTimeout(() => {
                        stub.mockImplementation(() => 20);
                        camera.simulateFrame();
                    }, 0);
                });

                // setTimeout to avoid a synchronous callback
                setTimeout(() => {
                    stub.mockImplementation(() => 10);
                    camera.simulateFrame();
                }, 0);
            });
        });

        test('pans eastward across the antimeridian', async () => {
            const camera = createCamera();
            const stub = vi.spyOn(browser, 'now');

            camera.setCenter([170, 0]);

            await new Promise(resolve => {
                let crossedAntimeridian;

                camera.on('move', () => {
                    if (camera.getCenter().lng > 170) {
                        crossedAntimeridian = true;
                    }
                });

                camera.on('moveend', () => {
                    expect(crossedAntimeridian).toBeTruthy();
                    resolve();
                });

                stub.mockImplementation(() => 0);
                camera.easeTo({center: [-170, 0], duration: 10});

                setTimeout(() => {
                    stub.mockImplementation(() => 1);
                    camera.simulateFrame();

                    setTimeout(() => {
                        stub.mockImplementation(() => 10);
                        camera.simulateFrame();
                    }, 0);
                }, 0);
            });
        });

        test('pans westward across the antimeridian', async () => {
            const camera = createCamera();
            const stub = vi.spyOn(browser, 'now');

            camera.setCenter([-170, 0]);
            let crossedAntimeridian;

            await new Promise(resolve => {
                camera.on('move', () => {
                    if (camera.getCenter().lng < -170) {
                        crossedAntimeridian = true;
                    }
                });

                camera.on('moveend', () => {
                    expect(crossedAntimeridian).toBeTruthy();
                    resolve();
                });

                stub.mockImplementation(() => 0);
                camera.easeTo({center: [170, 0], duration: 10});

                setTimeout(() => {
                    stub.mockImplementation(() => 1);
                    camera.simulateFrame();

                    setTimeout(() => {
                        stub.mockImplementation(() => 10);
                        camera.simulateFrame();
                    }, 0);
                }, 0);
            });
        });

        test(
            'animation occurs when prefers-reduced-motion: reduce is set but overridden by essential: true',
            async () => {
                const camera = createCamera();
                vi.spyOn(browser, 'prefersReducedMotion', 'get').mockImplementation(() => true);
                const stubNow = vi.spyOn(browser, 'now');

                // camera transition expected to take in this range when prefersReducedMotion is set and essential: true,
                // when a duration of 200 is requested
                const min = 100;
                const max = 300;

                await new Promise(resolve => {

                    let startTime;
                    camera
                        .on('movestart', () => { startTime = browser.now(); })
                        .on('moveend', () => {
                            const endTime = browser.now();
                            const timeDiff = endTime - startTime;
                            expect(timeDiff >= min && timeDiff < max).toBeTruthy();
                            resolve();
                        });

                    setTimeout(() => {
                        stubNow.mockImplementation(() => 0);
                        camera.simulateFrame();

                        camera.easeTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 200, essential: true});

                        setTimeout(() => {
                            stubNow.mockImplementation(() => 200);
                            camera.simulateFrame();
                        }, 0);
                    }, 0);
                });
            }
        );

        test(
            'animation occurs when prefers-reduced-motion: reduce is set but overridden by respectPrefersReducedMotion: false',
            async () => {
                const camera = createCamera({respectPrefersReducedMotion: false});

                vi.spyOn(browser, 'prefersReducedMotion', 'get').mockImplementation(() => true);
                const stubNow = vi.spyOn(browser, 'now');

                // camera transition expected to take in this range when prefersReducedMotion is set and essential: true,
                // when a duration of 200 is requested
                const min = 100;
                const max = 300;

                let startTime;
                await new Promise(resolve => {
                    camera
                        .on('movestart', () => { startTime = browser.now(); })
                        .on('moveend', () => {
                            const endTime = browser.now();
                            const timeDiff = endTime - startTime;
                            expect(timeDiff >= min && timeDiff < max).toBeTruthy();
                            resolve();
                        });

                    setTimeout(() => {
                        stubNow.mockImplementation(() => 0);
                        camera.simulateFrame();

                        camera.easeTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 200});

                        setTimeout(() => {
                            stubNow.mockImplementation(() => 200);
                            camera.simulateFrame();
                        }, 0);
                    }, 0);
                });

            }
        );

        test('duration is 0 when prefers-reduced-motion: reduce is set', async () => {
            const camera = createCamera();
            vi.spyOn(browser, 'prefersReducedMotion', 'get').mockImplementation(() => true);
            await assertTransitionTime(camera, 0, 10, () => {
                camera.easeTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 1000});
            });
        });

        describe('Globe', () => {
            test('pans to specified location', () => {
                const camera = createCamera();
                camera.transform.zoom = 4;
                camera.transform.setProjection({name: 'globe'});

                camera.easeTo({center: [90, 10], duration:0});
                expect(camera.getCenter()).toEqual({lng: 90, lat: 10});
            });

            test('rotate the globe once around its axis', () => {
                const camera = createCamera();
                const stub = vi.spyOn(browser, 'now');
                stub.mockImplementation(() => 0);

                camera.transform.zoom = 4;
                camera.transform.setProjection({name: 'globe'});

                camera.easeTo({center: [-180.0, 0], duration: 50, easing: e => e});

                camera.simulateFrame();
                expect(camera.getCenter()).toEqual({lng: 0, lat: 0});

                stub.mockImplementation(() => 25);
                camera.simulateFrame();
                expect(camera.getCenter()).toEqual({lng: -90, lat: 0});

                stub.mockImplementation(() => 50);
                camera.simulateFrame();
                expect(camera.getCenter()).toEqual({lng: 180, lat: 0});

                camera.easeTo({center: [0, 0], duration: 50, easing: e => e});

                stub.mockImplementation(() => 75);
                camera.simulateFrame();
                expect(camera.getCenter()).toEqual({lng: 90, lat: 0});

                stub.mockImplementation(() => 100);
                camera.simulateFrame();
                expect(camera.getCenter()).toEqual({lng: 0, lat: 0});
            });

            test('pans with padding', () => {
                const camera = createCamera();
                camera.transform.setProjection({name: 'globe'});

                camera.easeTo({center: [90, 0], duration:0, padding:{top: 100}});
                expect(camera.getCenter()).toEqual({lng: 90, lat: 0});
                expect(camera.getPadding()).toEqual({top:100, bottom:0, left:0, right:0});
            });

            test('pans with specified offset and bearing', () => {
                const camera = createCamera();
                const stub = vi.spyOn(browser, 'now');
                stub.mockImplementation(() => 0);

                camera.transform.setProjection({name: 'globe'});
                camera.easeTo({center: [170, 0], offset: [100, 0], duration: 2000, bearing: 45});

                for (let i = 1; i <= 10; i++) {
                    stub.mockImplementation(() => i * 200);
                    camera.simulateFrame();
                }

                expect(fixedLngLat(camera.getCenter())).toEqual({lng: 99.6875, lat: 0});
            });

            test('reset north', () => {
                const camera = createCamera();
                const stub = vi.spyOn(browser, 'now');
                stub.mockImplementation(() => 0);

                camera.transform.zoom = 4;
                camera.transform.bearing = 160;
                camera.transform.pitch = 20;
                camera.transform.setProjection({name: 'globe'});

                camera.resetNorth({easing: e => e});
                camera.simulateFrame();

                expect(camera.transform.bearing).toEqual(160);

                stub.mockImplementation(() => 250);
                camera.simulateFrame();
                expect(camera.transform.bearing).toEqual(120);

                stub.mockImplementation(() => 500);
                camera.simulateFrame();
                expect(camera.transform.bearing).toEqual(80);

                stub.mockImplementation(() => 750);
                camera.simulateFrame();
                expect(camera.transform.bearing).toEqual(40);

                stub.mockImplementation(() => 1000);
                camera.simulateFrame();
                expect(camera.transform.bearing).toEqual(0);
                expect(camera.transform.pitch).toEqual(20);
            });

            test('reset north and pitch', () => {
                const camera = createCamera();
                const stub = vi.spyOn(browser, 'now');
                stub.mockImplementation(() => 0);

                camera.transform.zoom = 4;
                camera.transform.bearing = 160;
                camera.transform.pitch = 20;
                camera.transform.setProjection({name: 'globe'});

                camera.resetNorthPitch({easing: e => e});
                camera.simulateFrame();

                expect(camera.transform.bearing).toEqual(160);
                expect(camera.transform.pitch).toEqual(20);

                stub.mockImplementation(() => 250);
                camera.simulateFrame();
                expect(camera.transform.bearing).toEqual(120);
                expect(camera.transform.pitch).toEqual(15);

                stub.mockImplementation(() => 500);
                camera.simulateFrame();
                expect(camera.transform.bearing).toEqual(80);
                expect(camera.transform.pitch).toEqual(10);

                stub.mockImplementation(() => 750);
                camera.simulateFrame();
                expect(camera.transform.bearing).toEqual(40);
                expect(camera.transform.pitch).toEqual(5);

                stub.mockImplementation(() => 1000);
                camera.simulateFrame();
                expect(camera.transform.bearing).toEqual(0);
                expect(camera.transform.pitch).toEqual(0);
            });

            test('sets bearing', () => {
                const camera = createCamera();
                camera.transform.setProjection({name: 'globe'});

                camera.setBearing(4);
                expect(camera.getBearing()).toEqual(4);
            });

            test('sets center', () => {
                const camera = createCamera();
                camera.transform.setProjection({name: 'globe'});
                camera.transform.zoom = 2;

                camera.setCenter([1, 2]);
                expect(camera.getCenter()).toEqual({lng: 1, lat: 2});
            });

            test('invoke `panBy` with specific amount', () => {
                const camera = createCamera();
                camera.transform.setProjection({name: 'globe'});

                camera.panBy([100, 0], {duration: 0});
                expect(fixedLngLat(camera.getCenter())).toEqual({lng: 70.3125, lat: 0});
            });

            test(
                'invoke `panBy` with specific amount with rotated and pitched camera',
                () => {
                    const camera = createCamera();
                    camera.transform.setProjection({name: 'globe'});
                    camera.transform.bearing = 90;
                    camera.transform.pitch = 45;
                    camera.transform.zoom = 3;

                    // Expect linear movement to both directions
                    camera.panBy([700, 0], {duration: 0});
                    expect(fixedLngLat(camera.getCenter())).toEqual({lng: 0, lat: -52.268157374});

                    camera.panBy([-700, 0], {duration: 0});
                    expect(fixedLngLat(camera.getCenter())).toEqual({lng: 0, lat: 0});
                }
            );

            test('invoke `panTo` with specific amount', () => {
                const camera = createCamera();
                camera.transform.setProjection({name: 'globe'});

                camera.panTo([100, 0], {duration: 0});
                expect(camera.getCenter()).toEqual({lng: 100, lat: 0});
            });
        });
    });

    describe('#flyTo', () => {
        test('pans to specified location', () => {
            const camera = createCamera();
            camera.flyTo({center: [100, 0], animate: false});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 0});
        });

        test('throws on invalid center argument', () => {
            const camera = createCamera();
            expect(() => {
                camera.flyTo({center: 1});
            }).toThrowError(Error);
        });

        test(
            'does not throw when cameras current zoom is sufficiently greater than passed zoom option',
            () => {
                const camera = createCamera({zoom: 22, center:[0, 0]});
                expect(() => {
                    camera.flyTo({zoom:10, center:[0, 0]});
                }).not.toThrowError();
            }
        );

        test(
            'does not throw when cameras current zoom is above maxzoom and an offset creates infinite zoom out factor',
            () => {
                const transform = new Transform(0, 20.9999, 0, 60, true);
                transform.resize(512, 512);
                const camera = attachSimulateFrame(new Camera(transform, {}))
                    .jumpTo({zoom: 21, center:[0, 0]});
                camera._update = () => {};
                camera._preloadTiles = () => {};

                expect(() => camera.flyTo({zoom:7.5, center:[0, 0], offset:[0, 70]})).not.toThrowError();
            }
        );

        test('zooms to specified level', () => {
            const camera = createCamera();
            camera.flyTo({zoom: 3.2, animate: false});
            expect(fixedNum(camera.getZoom())).toEqual(3.2);
        });

        test('zooms to integer level without floating point errors', () => {
            const camera = createCamera({zoom: 0.6});
            camera.flyTo({zoom: 2, animate: false});
            expect(camera.getZoom()).toEqual(2);
        });

        test(
            'Zoom out from the same position to the same position with animation',
            async () => {
                const pos = {lng: 0, lat: 0};
                const camera = createCamera({zoom: 20, center: pos});
                const stub = vi.spyOn(browser, 'now');

                await new Promise(resolve => {
                    camera.once('zoomend', () => {
                        expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat(pos));
                        expect(camera.getZoom()).toEqual(19);
                        resolve();
                    });
                    stub.mockImplementation(() => 0);
                    camera.flyTo({zoom: 19, center: pos, duration: 2});

                    stub.mockImplementation(() => 3);
                    camera.simulateFrame();
                });

            }
        );

        test('rotates to specified bearing', () => {
            const camera = createCamera();
            camera.flyTo({bearing: 90, animate: false});
            expect(camera.getBearing()).toEqual(90);
        });

        test('tilts to specified pitch', () => {
            const camera = createCamera();
            camera.flyTo({pitch: 45, animate: false});
            expect(camera.getPitch()).toEqual(45);
        });

        test('pans and zooms', () => {
            const camera = createCamera();
            camera.flyTo({center: [100, 0], zoom: 3.2, animate: false});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 0});
            expect(fixedNum(camera.getZoom())).toEqual(3.2);
        });

        test('pans and rotates', () => {
            const camera = createCamera();
            camera.flyTo({center: [100, 0], bearing: 90, animate: false});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 0});
            expect(camera.getBearing()).toEqual(90);
        });

        test('zooms and rotates', () => {
            const camera = createCamera();
            camera.flyTo({zoom: 3.2, bearing: 90, animate: false});
            expect(fixedNum(camera.getZoom())).toEqual(3.2);
            expect(camera.getBearing()).toEqual(90);
        });

        test('pans, zooms, and rotates', () => {
            const camera = createCamera();
            camera.flyTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, animate: false});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 0});
            expect(fixedNum(camera.getZoom())).toEqual(3.2);
            expect(camera.getBearing()).toEqual(90);
        });

        test('noop', () => {
            const camera = createCamera();
            camera.flyTo({animate: false});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 0, lat: 0});
            expect(camera.getZoom()).toEqual(0);
            expect(camera.getBearing()).toEqual(0);
        });

        test('noop with offset', () => {
            const camera = createCamera();
            camera.flyTo({offset: [100, 0], animate: false});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 0, lat: 0});
            expect(camera.getZoom()).toEqual(0);
            expect(camera.getBearing()).toEqual(0);
        });

        test('pans with specified offset', () => {
            const camera = createCamera();
            camera.flyTo({center: [100, 0], offset: [100, 0], animate: false});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 29.6875, lat: 0});
        });

        test(
            'pans with specified offset relative to viewport on a rotated camera',
            () => {
                const camera = createCamera({bearing: 180});
                camera.easeTo({center: [100, 0], offset: [100, 0], animate: false});
                expect(fixedLngLat(camera.getCenter())).toEqual({lng: 170.3125, lat: 0});
            }
        );

        test(
            'emits move, zoom, rotate, and pitch events, preserving eventData',
            async () => {
                const camera = createCamera();
                let movestarted, moved, zoomstarted, zoomed, rotatestarted, rotated, pitchstarted, pitched;
                const eventData = {data: 'ok'};

                const movePromise = new Promise(resolve => {
                    camera
                        .on('movestart', (d) => { movestarted = d.data; })
                        .on('move', (d) => { moved = d.data; })
                        .on('rotate', (d) => { rotated = d.data; })
                        .on('pitch', (d) => { pitched = d.data; })
                        .on('moveend', function(d) {
                            expect(this._zooming).toBeFalsy();
                            expect(this._panning).toBeFalsy();
                            expect(this._rotating).toBeFalsy();

                            expect(movestarted).toEqual('ok');
                            expect(moved).toEqual('ok');
                            expect(zoomed).toEqual('ok');
                            expect(rotated).toEqual('ok');
                            expect(pitched).toEqual('ok');
                            expect(d.data).toEqual('ok');
                            resolve();
                        });
                });

                const zoomPromise = new Promise(resolve => {
                    camera
                        .on('zoomstart', (d) => { zoomstarted = d.data; })
                        .on('zoom', (d) => { zoomed = d.data; })
                        .on('zoomend', (d) => {
                            expect(zoomstarted).toEqual('ok');
                            expect(zoomed).toEqual('ok');
                            expect(d.data).toEqual('ok');
                            resolve();
                        });
                });

                const rotatePromise = new Promise(resolve => {
                    camera
                        .on('rotatestart', (d) => { rotatestarted = d.data; })
                        .on('rotate', (d) => { rotated = d.data; })
                        .on('rotateend', (d) => {
                            expect(rotatestarted).toEqual('ok');
                            expect(rotated).toEqual('ok');
                            expect(d.data).toEqual('ok');
                            resolve();
                        });
                });

                const pitchPromise = new Promise(resolve => {
                    camera
                        .on('pitchstart', (d) => { pitchstarted = d.data; })
                        .on('pitch', (d) => { pitched = d.data; })
                        .on('pitchend', (d) => {
                            expect(pitchstarted).toEqual('ok');
                            expect(pitched).toEqual('ok');
                            expect(d.data).toEqual('ok');
                            resolve();
                        });
                });

                await Promise.all([
                    movePromise,
                    zoomPromise,
                    rotatePromise,
                    pitchPromise,
                    Promise.resolve(
                        camera.flyTo(
                            {center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, pitch: 45, animate: false},
                            eventData
                        )
                    )
                ]);
            }
        );

        test(
            'for short flights, emits (solely) move events, preserving eventData',
            async () => {
                //As I type this, the code path for guiding super-short flights is (and will probably remain) different.
                //As such; it deserves a separate test case. This test case flies the map from A to A.
                const camera = createCamera({center: [100, 0]});
                let movestarted, moved,
                    zoomstarted, zoomed, zoomended,
                    rotatestarted, rotated, rotateended,
                    pitchstarted, pitched, pitchended;
                const eventData = {data: 'ok'};

                camera
                    .on('movestart', (d) => { movestarted = d.data; })
                    .on('move', (d) => { moved = d.data; })
                    .on('zoomstart', (d) => { zoomstarted = d.data; })
                    .on('zoom', (d) => { zoomed = d.data; })
                    .on('zoomend', (d) => { zoomended = d.data; })
                    .on('rotatestart', (d) => { rotatestarted = d.data; })
                    .on('rotate', (d) => { rotated = d.data; })
                    .on('rotateend', (d) => { rotateended = d.data; })
                    .on('pitchstart', (d) => { pitchstarted = d.data; })
                    .on('pitch', (d) => { pitched = d.data; })
                    .on('pitchend', (d) => { pitchended = d.data; })
                    .on('moveend', function(d) {
                        expect(this._zooming).toBeFalsy();
                        expect(this._panning).toBeFalsy();
                        expect(this._rotating).toBeFalsy();

                        expect(movestarted).toEqual('ok');
                        expect(moved).toEqual('ok');
                        expect(zoomstarted).toEqual(undefined);
                        expect(zoomed).toEqual(undefined);
                        expect(zoomended).toEqual(undefined);
                        expect(rotatestarted).toEqual(undefined);
                        expect(rotated).toEqual(undefined);
                        expect(rotateended).toEqual(undefined);
                        expect(pitched).toEqual(undefined);
                        expect(pitchstarted).toEqual(undefined);
                        expect(pitchended).toEqual(undefined);
                        expect(d.data).toEqual('ok');
                    });

                const stub = vi.spyOn(browser, 'now');
                stub.mockImplementation(() => 0);

                camera.flyTo({center: [100, 0], duration: 10}, eventData);

                setTimeout(() => {
                    stub.mockImplementation(() => 1);
                    camera.simulateFrame();

                    setTimeout(() => {
                        stub.mockImplementation(() => 10);
                        camera.simulateFrame();
                    }, 0);
                }, 0);
            }
        );

        test('stops existing ease', () => {
            const camera = createCamera();
            camera.flyTo({center: [200, 0], duration: 100});
            camera.flyTo({center: [100, 0], duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 0});
        });

        test('can be called from within a moveend event handler', async () => {
            const camera = createCamera();
            const stub = vi.spyOn(browser, 'now');
            stub.mockImplementation(() => 0);

            await new Promise(resolve => {
                camera.flyTo({center: [100, 0], duration: 10});
                camera.once('moveend', () => {
                    camera.flyTo({center: [200, 0], duration: 10});
                    camera.once('moveend', () => {
                        camera.flyTo({center: [300, 0], duration: 10});
                        camera.once('moveend', () => {
                            resolve();
                        });
                    });
                });

                setTimeout(() => {
                    stub.mockImplementation(() => 10);
                    camera.simulateFrame();

                    setTimeout(() => {
                        stub.mockImplementation(() => 20);
                        camera.simulateFrame();

                        setTimeout(() => {
                            stub.mockImplementation(() => 30);
                            camera.simulateFrame();
                        }, 0);
                    }, 0);
                }, 0);
            });
        });

        test('ascends', async () => {
            const camera = createCamera();
            camera.setZoom(18);
            let ascended;

            await new Promise(resolve => {

                camera.on('zoom', () => {
                    if (camera.getZoom() < 18) {
                        ascended = true;
                    }
                });

                camera.on('moveend', () => {
                    expect(ascended).toBeTruthy();
                    resolve();
                });

                const stub = vi.spyOn(browser, 'now');
                stub.mockImplementation(() => 0);

                camera.flyTo({center: [100, 0], zoom: 18, duration: 10});

                setTimeout(() => {
                    stub.mockImplementation(() => 1);
                    camera.simulateFrame();

                    setTimeout(() => {
                        stub.mockImplementation(() => 10);
                        camera.simulateFrame();
                    }, 0);
                }, 0);
            });
        });

        test('pans eastward across the prime meridian', async () => {
            const camera = createCamera();
            const stub = vi.spyOn(browser, 'now');

            camera.setCenter([-10, 0]);

            await new Promise(resolve => {

                let crossedPrimeMeridian;

                camera.on('move', () => {
                    if (Math.abs(camera.getCenter().lng) < 10) {
                        crossedPrimeMeridian = true;
                    }
                });

                camera.on('moveend', () => {
                    expect(crossedPrimeMeridian).toBeTruthy();
                    resolve();
                });

                stub.mockImplementation(() => 0);
                camera.flyTo({center: [10, 0], duration: 20});

                setTimeout(() => {
                    stub.mockImplementation(() => 1);
                    camera.simulateFrame();

                    setTimeout(() => {
                        stub.mockImplementation(() => 20);
                        camera.simulateFrame();
                    }, 0);
                }, 0);
            });
        });

        test('pans westward across the prime meridian', async () => {
            const camera = createCamera();
            const stub = vi.spyOn(browser, 'now');

            camera.setCenter([10, 0]);

            await new Promise(resolve => {
                let crossedPrimeMeridian;

                camera.on('move', () => {
                    if (Math.abs(camera.getCenter().lng) < 10) {
                        crossedPrimeMeridian = true;
                    }
                });

                camera.on('moveend', () => {
                    expect(crossedPrimeMeridian).toBeTruthy();
                    resolve();
                });

                stub.mockImplementation(() => 0);
                camera.flyTo({center: [-10, 0], duration: 20});

                setTimeout(() => {
                    stub.mockImplementation(() => 1);
                    camera.simulateFrame();

                    setTimeout(() => {
                        stub.mockImplementation(() => 20);
                        camera.simulateFrame();
                    }, 0);
                }, 0);
            });
        });

        test('pans eastward across the antimeridian', async () => {
            const camera = createCamera();
            const stub = vi.spyOn(browser, 'now');

            camera.setCenter([170, 0]);

            await new Promise(resolve => {

                let crossedAntimeridian;

                camera.on('move', () => {
                    if (camera.getCenter().lng > 170) {
                        crossedAntimeridian = true;
                    }
                });

                camera.on('moveend', () => {
                    expect(crossedAntimeridian).toBeTruthy();
                    resolve();
                });

                stub.mockImplementation(() => 0);
                camera.flyTo({center: [-170, 0], duration: 20});

                setTimeout(() => {
                    stub.mockImplementation(() => 1);
                    camera.simulateFrame();

                    setTimeout(() => {
                        stub.mockImplementation(() => 20);
                        camera.simulateFrame();
                    }, 0);
                }, 0);
            });
        });

        test('pans westward across the antimeridian', async () => {
            const camera = createCamera();
            const stub = vi.spyOn(browser, 'now');

            camera.setCenter([-170, 0]);

            await new Promise(resolve => {

                let crossedAntimeridian;

                camera.on('move', () => {
                    if (camera.getCenter().lng < -170) {
                        crossedAntimeridian = true;
                    }
                });

                camera.on('moveend', () => {
                    expect(crossedAntimeridian).toBeTruthy();
                    resolve();
                });

                stub.mockImplementation(() => 0);
                camera.flyTo({center: [170, 0], duration: 10});

                setTimeout(() => {
                    stub.mockImplementation(() => 1);
                    camera.simulateFrame();

                    setTimeout(() => {
                        stub.mockImplementation(() => 10);
                        camera.simulateFrame();
                    }, 0);
                }, 0);
            });
        });

        test(
            'does not pan eastward across the antimeridian if no world copies',
            async () => {
                const camera = createCamera({renderWorldCopies: false});
                const stub = vi.spyOn(browser, 'now');

                camera.setCenter([170, 0]);
                await new Promise(resolve => {

                    let crossedAntimeridian;

                    camera.on('move', () => {
                        if (camera.getCenter().lng > 170) {
                            crossedAntimeridian = true;
                        }
                    });

                    camera.on('moveend', () => {
                        expect(crossedAntimeridian).toBeFalsy();
                        resolve();
                    });

                    stub.mockImplementation(() => 0);
                    camera.flyTo({center: [-170, 0], duration: 10});

                    setTimeout(() => {
                        stub.mockImplementation(() => 1);
                        camera.simulateFrame();

                        setTimeout(() => {
                            stub.mockImplementation(() => 10);
                            camera.simulateFrame();
                        }, 0);
                    }, 0);
                });
            }
        );

        test(
            'does not pan westward across the antimeridian if no world copies',
            async () => {
                const camera = createCamera({renderWorldCopies: false});
                const stub = vi.spyOn(browser, 'now');

                camera.setCenter([-170, 0]);
                await new Promise(resolve => {

                    let crossedAntimeridian;

                    camera.on('move', () => {
                        if (fixedLngLat(camera.getCenter(), 10).lng < -170) {
                            crossedAntimeridian = true;
                        }
                    });

                    camera.on('moveend', () => {
                        expect(crossedAntimeridian).toBeFalsy();
                        resolve();
                    });

                    stub.mockImplementation(() => 0);
                    camera.flyTo({center: [170, 0], duration: 10});

                    setTimeout(() => {
                        stub.mockImplementation(() => 1);
                        camera.simulateFrame();

                        setTimeout(() => {
                            stub.mockImplementation(() => 10);
                            camera.simulateFrame();
                        }, 0);
                    }, 0);
                });
            }
        );

        test('jumps back to world 0 when crossing the antimeridian', async () => {
            const camera = createCamera();
            const stub = vi.spyOn(browser, 'now');

            camera.setCenter([-170, 0]);

            await new Promise(resolve => {

                let leftWorld0 = false;

                camera.on('move', () => {
                    leftWorld0 = leftWorld0 || (camera.getCenter().lng < -180);
                });

                camera.on('moveend', () => {
                    expect(leftWorld0).toBeFalsy();
                    resolve();
                });

                stub.mockImplementation(() => 0);
                camera.flyTo({center: [170, 0], duration: 10});

                setTimeout(() => {
                    stub.mockImplementation(() => 1);
                    camera.simulateFrame();

                    setTimeout(() => {
                        stub.mockImplementation(() => 10);
                        camera.simulateFrame();
                    }, 0);
                }, 0);
            });
        });

        test('peaks at the specified zoom level', async () => {
            const camera = createCamera({zoom: 20});
            const stub = vi.spyOn(browser, 'now');

            const minZoom = 1;

            await new Promise(resolve => {

                let zoomed = false;

                camera.on('zoom', () => {
                    const zoom = camera.getZoom();
                    if (zoom < 1) {
                        expect.unreachable(`${zoom} should be >= ${minZoom} during flyTo`);
                    }

                    if (camera.getZoom() < (minZoom + 1)) {
                        zoomed = true;
                    }
                });

                camera.on('moveend', () => {
                    // zoom came within satisfactory range of minZoom provided
                    expect(zoomed).toBeTruthy();
                    resolve();
                });

                stub.mockImplementation(() => 0);
                camera.flyTo({center: [1, 0], zoom: 20, minZoom, duration: 10});

                setTimeout(() => {
                    stub.mockImplementation(() => 3);
                    camera.simulateFrame();

                    setTimeout(() => {
                        stub.mockImplementation(() => 10);
                        camera.simulateFrame();
                    }, 0);
                }, 0);
            });
        });

        test('respects transform\'s maxZoom', async () => {
            const transform = new Transform(2, 10, 0, 60, false);
            transform.resize(512, 512);

            const camera = attachSimulateFrame(new Camera(transform, {}));
            camera._update = () => {};
            camera._preloadTiles = () => {};

            await new Promise(resolve => {
                camera.on('moveend', () => {
                    equalWithPrecision(camera.getZoom(), 10, 1e-10);
                    const {lng, lat} = camera.getCenter();
                    equalWithPrecision(lng, 12, 1e-10);
                    equalWithPrecision(lat, 34, 1e-10);

                    resolve();
                });

                const stub = vi.spyOn(browser, 'now');
                stub.mockImplementation(() => 0);
                camera.flyTo({center: [12, 34], zoom: 30, duration: 10});

                setTimeout(() => {
                    stub.mockImplementation(() => 10);
                    camera.simulateFrame();
                }, 0);
            });
        });

        test('respects transform\'s minZoom', async () => {
            const transform = new Transform(2, 10, 0, 60, false);
            transform.resize(512, 512);

            const camera = attachSimulateFrame(new Camera(transform, {}));
            camera._update = () => {};
            camera._preloadTiles = () => {};

            await new Promise(resolve => {
                camera.on('moveend', () => {
                    equalWithPrecision(camera.getZoom(), 2, 1e-10);
                    const {lng, lat} = camera.getCenter();
                    equalWithPrecision(lng, 12, 1e-10);
                    equalWithPrecision(lat, 34, 1e-10);

                    resolve();
                });

                const stub = vi.spyOn(browser, 'now');
                stub.mockImplementation(() => 0);
                camera.flyTo({center: [12, 34], zoom: 1, duration: 10});

                setTimeout(() => {
                    stub.mockImplementation(() => 10);
                    camera.simulateFrame();
                }, 0);
            });
        });

        test('resets duration to 0 if it exceeds maxDuration', async () => {
            let startTime, endTime, timeDiff;
            const camera = createCamera({center: [37.63454, 55.75868], zoom: 18});

            await new Promise(resolve => {
                camera
                    .on('movestart', () => { startTime = browser.now(); })
                    .on('moveend', () => {
                        endTime = browser.now();
                        timeDiff = endTime - startTime;
                        equalWithPrecision(timeDiff, 0, 1e+1);
                        resolve();
                    });

                camera.flyTo({center: [-122.3998631, 37.7884307], maxDuration: 100});
            });
        });

        test('flys instantly when prefers-reduce-motion:reduce is set', async () => {
            const camera = createCamera();
            vi.spyOn(browser, 'prefersReducedMotion', 'get').mockImplementation(() => true);
            await assertTransitionTime(camera, 0, 10, () => {
                camera.flyTo({center: [100, 0], bearing: 90, animate: true});
            });
        });
    });

    describe('#isEasing', () => {
        test('returns false when not easing', () => {
            const camera = createCamera();
            expect(!camera.isEasing()).toBeTruthy();
        });

        test('returns true when panning', () => {
            const camera = createCamera();
            camera.panTo([100, 0], {duration: 1});
            expect(camera.isEasing()).toBeTruthy();
        });

        test('returns false when done panning', async () => {
            const camera = createCamera();

            await new Promise(resolve => {
                camera.on('moveend', () => {
                    expect(camera.isEasing()).toBeFalsy();
                    resolve();
                });
                const stub = vi.spyOn(browser, 'now');
                stub.mockImplementation(() => 0);
                camera.panTo([100, 0], {duration: 1});
                setTimeout(() => {
                    stub.mockImplementation(() => 1);
                    camera.simulateFrame();
                }, 0);
            });
        });

        test('returns true when zooming', () => {
            const camera = createCamera();
            camera.zoomTo(3.2, {duration: 1});
            expect(camera.isEasing()).toBeTruthy();
        });

        test('returns false when done zooming', async () => {
            const camera = createCamera();
            await new Promise(resolve => {
                camera.on('moveend', () => {
                    expect(camera.isEasing()).toBeFalsy();
                    resolve();
                });
                const stub = vi.spyOn(browser, 'now');
                stub.mockImplementation(() => 0);
                camera.zoomTo(3.2, {duration: 1});
                setTimeout(() => {
                    stub.mockImplementation(() => 1);
                    camera.simulateFrame();
                }, 0);
            });
        });

        test('returns true when rotating', () => {
            const camera = createCamera();
            camera.rotateTo(90, {duration: 1});
            expect(camera.isEasing()).toBeTruthy();
        });

        test('returns false when done rotating', async () => {
            const camera = createCamera();
            await new Promise(resolve => {
                camera.on('moveend', () => {
                    expect(camera.isEasing()).toBeFalsy();
                    resolve();
                });
                const stub = vi.spyOn(browser, 'now');
                stub.mockImplementation(() => 0);
                camera.rotateTo(90, {duration: 1});
                setTimeout(() => {
                    stub.mockImplementation(() => 1);
                    camera.simulateFrame();
                }, 0);
            });
        });
    });

    describe('#stop', () => {
        test('resets camera._zooming', () => {
            const camera = createCamera();
            camera.zoomTo(3.2);
            camera.stop();
            expect(!camera._zooming).toBeTruthy();
        });

        test('resets camera._rotating', () => {
            const camera = createCamera();
            camera.rotateTo(90);
            camera.stop();
            expect(!camera._rotating).toBeTruthy();
        });

        test('emits moveend if panning, preserving eventData', async () => {
            const camera = createCamera();
            const eventData = {data: 'ok'};

            await new Promise(resolve => {
                camera.once("moveend", d => {
                    expect(d.data).toEqual('ok');
                    resolve();
                });
                camera.panTo([100, 0], {}, eventData);
                camera.stop();
            });
        });

        test('emits moveend if zooming, preserving eventData', async () => {
            const camera = createCamera();
            const eventData = {data: 'ok'};

            await new Promise(resolve => {
                camera.once("moveend", d => {
                    expect(d.data).toEqual('ok');
                    resolve();
                });
                camera.zoomTo(3.2, {}, eventData);
                camera.stop();
            });
        });

        test('emits moveend if rotating, preserving eventData', async () => {
            const camera = createCamera();
            const eventData = {data: 'ok'};

            await new Promise(resolve => {
                camera.once("moveend", d => {
                    expect(d.data).toEqual('ok');
                    resolve();
                });
                camera.rotateTo(90, {}, eventData);
                camera.stop();
            });
        });

        test('does not emit moveend if not moving', async () => {
            const camera = createCamera();
            const eventData = {data: 'ok'};

            await new Promise(resolve => {
                camera.on('moveend', (d) => {
                    expect(d.data).toBe('ok');
                    camera.stop();
                    resolve();
                });

                const stub = vi.spyOn(browser, 'now');
                stub.mockImplementation(() => 0);
                camera.panTo([100, 0], {duration: 1}, eventData);

                setTimeout(() => {
                    stub.mockImplementation(() => 1);
                    camera.simulateFrame();
                }, 0);
            });
        });
    });

    describe('#cameraForBounds', () => {
        test('no options passed', () => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb);
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 34.7171});
            expect(fixedNum(transform.zoom, 3)).toEqual(2.469);
        });

        test('bearing positive number', () => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {bearing: 175});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 34.7171});
            expect(fixedNum(transform.zoom, 3)).toEqual(2.396);
            expect(transform.bearing).toEqual(175);
        });

        test('bearing and pitch', () => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {bearing: 175, pitch: 40});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 34.7171});
            expect(fixedNum(transform.zoom, 3)).toEqual(2.197);
            expect(transform.bearing).toEqual(175);
            expect(transform.pitch).toEqual(40);
        });

        test('bearing negative number', () => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {bearing: -30});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 34.7171});
            expect(fixedNum(transform.zoom, 3)).toEqual(2.222);
            expect(transform.bearing).toEqual(-30);
        });

        test('padding number', () => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {padding: 15});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 34.7171});
            expect(fixedNum(transform.zoom, 3)).toEqual(2.382);
        });

        test('padding object', () => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {padding: {top: 15, right: 15, bottom: 15, left: 15}, duration: 0});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 34.7171});
        });

        test('asymmetrical padding', () => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {padding: {top: 10, right: 75, bottom: 50, left: 25}, duration: 0});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -96.5558, lat: 32.0833});
        });

        test('bearing and asymmetrical padding', () => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {bearing: 90, padding: {top: 10, right: 75, bottom: 50, left: 25}, duration: 0});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -103.3761, lat: 31.7099});
        });

        test(
            'bearing and asymmetrical padding and assymetrical viewport padding',
            () => {
                const camera = createCamera();
                camera.setPadding({left: 30, top: 35, right: 50, bottom: 65});
                const bb = [[-133, 16], [-68, 50]];

                const transform = camera.cameraForBounds(bb, {bearing: 90, padding: {top: 10, right: 75, bottom: 50, left: 25}, duration: 0});
                expect(fixedLngLat(transform.center, 4)).toEqual({lng: -104.1932, lat: 30.837});
            }
        );

        test('offset', () => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {offset: [0, 100]});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 44.4717});
        });

        test('offset as object', () => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {offset: {x: 0, y: 100}});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 44.4717});
        });

        test('offset and padding', () => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {padding: {top: 10, right: 75, bottom: 50, left: 25}, offset: [0, 100]});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -96.5558, lat: 44.4189});
        });

        test('bearing, asymmetrical padding, and offset', () => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {bearing: 90, padding: {top: 10, right: 75, bottom: 50, left: 25}, offset: [0, 100], duration: 0});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -103.3761, lat: 43.0929});
        });
    });

    describe('#fitScreenCoordinates with globe', () => {
        test('bearing 225', () => {
            const camera = createCamera({projection: {name: 'globe'}});
            const p0 = [128, 128];
            const p1 = [256, 384];
            const bearing = 225;

            camera.fitScreenCoordinates(p0, p1, bearing, {duration:0});
            expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -39.7287, lat: -0});
            expect(fixedNum(camera.getZoom(), 3)).toEqual(0.946);
            expect(camera.getBearing()).toEqual(-135);
            expect(camera.getPitch()).toEqual(0);
        });

        test('bearing 225, pitch 30', () => {
            const pitch = 30;
            const camera = createCamera({projection: {name: 'globe'}, pitch});
            const p0 = [100, 500];
            const p1 = [300, 510];
            const bearing = 225;

            camera.fitScreenCoordinates(p0, p1, bearing, {duration:0});
            expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: 17.5434, lat: -80.2279});
            expect(fixedNum(camera.getZoom(), 3)).toEqual(1.311);
            expect(camera.getBearing()).toEqual(-135);
        });

        test('bearing 0', () => {
            const camera = createCamera({projection: {name: 'globe'}});

            const p0 = [128, 128];
            const p1 = [256, 384];
            const bearing = 0;

            camera.fitScreenCoordinates(p0, p1, bearing, {duration:0});
            expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -39.7287, lat: -0});
            expect(fixedNum(camera.getZoom(), 3)).toEqual(1.164);
            expect(camera.getBearing()).toEqual(0);
        });
    });

    describe('#cameraForBounds with Globe', () => {
        test('no options passed', () => {
            const camera = createCamera({projection: {name: 'globe'}});
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb);
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 34.716});
            expect(fixedNum(transform.zoom, 3)).toEqual(2.106);
        });

        test('bearing positive number', () => {
            const camera = createCamera({projection: {name: 'globe'}});
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {bearing: 175});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 34.716});
            expect(fixedNum(transform.zoom, 3)).toEqual(2.034);
            expect(transform.bearing).toEqual(175);
        });

        test('bearing negative number', () => {
            const camera = createCamera({projection: {name: 'globe'}});
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {bearing: -30});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 34.716});
            expect(fixedNum(transform.zoom, 3)).toEqual(1.868);
            expect(transform.bearing).toEqual(-30);
        });

        test('entire longitude range: -180 to 180', () => {
            const camera = createCamera({projection: {name: 'globe'}});
            const bb = [[-180, 10], [180, 50]];

            const transform = camera.cameraForBounds(bb);
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: 180, lat: 80});
            expect(fixedNum(transform.zoom, 3)).toEqual(1.072);
        });
    });

    describe('#fitBounds', () => {
        test('no padding passed', () => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            camera.fitBounds(bb, {duration:0});
            expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -100.5, lat: 34.7171});
            expect(fixedNum(camera.getZoom(), 3)).toEqual(2.469);
        });

        test('padding number', () => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            camera.fitBounds(bb, {padding: 15, duration:0});
            expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -100.5, lat: 34.7171});
            expect(fixedNum(camera.getZoom(), 3)).toEqual(2.382);
        });

        test('padding is calculated with bearing', () => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            camera.fitBounds(bb, {bearing: 45, duration:0});
            expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -100.5, lat: 34.7171});
            expect(fixedNum(camera.getZoom(), 3)).toEqual(2.254);
        });

        test('padding object', () => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            camera.fitBounds(bb, {padding: {top: 10, right: 75, bottom: 50, left: 25}, duration:0});
            expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -96.5558, lat: 32.0833});
        });

        test('padding object with pitch', () => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            camera.fitBounds(bb, {padding: {top: 10, right: 75, bottom: 50, left: 25}, duration:0, pitch: 30});
            expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -96.5558, lat: 32.4408});
            expect(camera.getPitch()).toEqual(30);
        });

        test('padding does not get propagated to transform.padding', () => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            camera.fitBounds(bb, {padding: {top: 10, right: 75, bottom: 50, left: 25}, duration:0});
            expect(camera.transform.padding).toEqual({
                left: 0,
                right: 0,
                top: 0,
                bottom: 0
            });
            camera.flyTo({center: [0, 0], zoom: 10, padding: {top: 10, right: 75, bottom: 50, left: 25}, animate: false});
            expect(camera.transform.padding).toStrictEqual({
                left: 0,
                right: 0,
                top: 0,
                bottom: 0
            });
        });

        test('#12450', () => {
            const camera = createCamera();

            camera.setCenter([-115.6288447, 35.1509267]);
            camera.setZoom(5);

            const bounds = new LngLatBounds();
            bounds.extend([-115.6288447, 35.1509267]);
            camera.fitBounds(bounds, {padding: 75, duration: 0});

            expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -115.6288, lat: 35.1509});
            expect(camera.getZoom()).toEqual(20);
        });
    });

    describe('#fitScreenCoordinates', () => {
        test('bearing 225', () => {
            const camera = createCamera();
            const p0 = [128, 128];
            const p1 = [256, 384];
            const bearing = 225;

            camera.fitScreenCoordinates(p0, p1, bearing, {duration:0});
            expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -45, lat: 0});
            expect(fixedNum(camera.getZoom(), 3)).toEqual(0.915); // 0.915 ~= log2(4*sqrt(2)/3)
            expect(camera.getBearing()).toEqual(-135);
            expect(camera.getPitch()).toEqual(0);
        });

        test('bearing 225, pitch 30', () => {
            const pitch = 30;
            const camera = createCamera({pitch});
            const p0 = [200, 500];
            const p1 = [210, 510];
            const bearing = 225;

            camera.fitScreenCoordinates(p0, p1, bearing, {duration:0});
            expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -30.215, lat: -84.1374});
            expect(fixedNum(camera.getZoom(), 3)).toEqual(5.2);
            expect(camera.getBearing()).toEqual(-135);
        });

        test('bearing 225, pitch 30 and 60 at end of animation', () => {
            const pitch = 30;
            const camera = createCamera({pitch});
            const p0 = [200, 500];
            const p1 = [210, 510];
            const bearing = 225;

            camera.fitScreenCoordinates(p0, p1, bearing, {duration:0, pitch: 60});
            expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -30.215, lat: -84.1374});
            expect(fixedNum(camera.getZoom(), 3)).toEqual(5.056);
            expect(camera.getBearing()).toEqual(-135);
            expect(camera.getPitch()).toEqual(60);
        });

        test('bearing 225, pitch 80, over horizon', () => {
            const pitch = 80;
            const camera = createCamera({pitch});
            const p0 = [128, 0];
            const p1 = [256, 10];
            const bearing = 225;

            const zoom = camera.getZoom();
            const center = camera.getCenter();
            camera.fitScreenCoordinates(p0, p1, bearing, {duration:0});
            expect(fixedLngLat(camera.getCenter(), 4)).toEqual(center);
            expect(fixedNum(camera.getZoom(), 3)).toEqual(zoom);
            expect(camera.getBearing()).toEqual(0);
            expect(camera.getPitch()).toEqual(pitch);
        });

        test('bearing 0', () => {
            const camera = createCamera();

            const p0 = [128, 128];
            const p1 = [256, 384];
            const bearing = 0;

            camera.fitScreenCoordinates(p0, p1, bearing, {duration:0});
            expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -45, lat: 0});
            expect(fixedNum(camera.getZoom(), 3)).toEqual(1);
            expect(camera.getBearing()).toEqual(0);
        });

        test('inverted points', () => {
            const camera = createCamera();
            const p1 = [128, 128];
            const p0 = [256, 384];
            const bearing = 0;

            camera.fitScreenCoordinates(p0, p1, bearing, {duration:0});
            expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -45, lat: 0});
            expect(fixedNum(camera.getZoom(), 3)).toEqual(1);
            expect(camera.getBearing()).toEqual(0);
        });
    });

    describe('FreeCameraOptions', () => {
        const camera = createCamera();

        const rotatedFrame = (quaternion) => {
            return {
                up: vec3.transformQuat([], [0, -1, 0], quaternion),
                forward: vec3.transformQuat([], [0, 0, -1], quaternion),
                right: vec3.transformQuat([], [1, 0, 0], quaternion)
            };
        };

        describe('lookAtPoint', () => {
            const options = new FreeCameraOptions();
            const cosPi4 = fixedNum(1.0 / Math.sqrt(2.0));
            let frame = null;

            // Pitch: 45, bearing: 0
            options.position = new MercatorCoordinate(0.5, 0.5, 0.5);
            options.lookAtPoint(new LngLat(0.0, 85.051128779806604));
            expect(options.orientation).toBeTruthy();
            frame = rotatedFrame(options.orientation);

            expect(fixedVec3(frame.right)).toEqual([1, 0, 0]);
            expect(fixedVec3(frame.up)).toEqual([0, -cosPi4, cosPi4]);
            expect(fixedVec3(frame.forward)).toEqual([0, -cosPi4, -cosPi4]);

            // Look directly to east
            options.position = new MercatorCoordinate(0.5, 0.5, 0.0);
            options.lookAtPoint(new LngLat(30, 0));
            expect(options.orientation).toBeTruthy();
            frame = rotatedFrame(options.orientation);

            expect(fixedVec3(frame.right)).toEqual([+0, 1, +0]);
            expect(fixedVec3(frame.up)).toEqual([0, 0, 1]);
            expect(fixedVec3(frame.forward)).toEqual([1, -0, -0]);

            // Pitch: 0, bearing: 0
            options.position = MercatorCoordinate.fromLngLat(new LngLat(24.9384, 60.1699), 100.0);
            options.lookAtPoint(new LngLat(24.9384, 60.1699), [0.0, -1.0, 0.0]);
            expect(options.orientation).toBeTruthy();
            frame = rotatedFrame(options.orientation);

            expect(fixedVec3(frame.right)).toEqual([1.0, 0.0, 0.0]);
            expect(fixedVec3(frame.up)).toEqual([0.0, -1.0, 0.0]);
            expect(fixedVec3(frame.forward)).toEqual([0.0, 0.0, -1.0]);

            // Pitch: 0, bearing: 45
            options.position = MercatorCoordinate.fromLngLat(new LngLat(24.9384, 60.1699), 100.0);
            options.lookAtPoint(new LngLat(24.9384, 60.1699), [-1.0, -1.0, 0.0]);
            expect(options.orientation).toBeTruthy();
            frame = rotatedFrame(options.orientation);

            expect(fixedVec3(frame.right)).toEqual([cosPi4, -cosPi4, 0.0]);
            expect(fixedVec3(frame.up)).toEqual([-cosPi4, -cosPi4, 0.0]);
            expect(fixedVec3(frame.forward)).toEqual([0.0, 0.0, -1.0]);

            // Looking south, up vector almost same as forward vector
            options.position = MercatorCoordinate.fromLngLat(new LngLat(122.4194, 37.7749));
            options.lookAtPoint(new LngLat(122.4194, 37.5), [0.0, 1.0, 0.00001]);
            expect(options.orientation).toBeTruthy();
            frame = rotatedFrame(options.orientation);

            expect(fixedVec3(frame.right)).toEqual([-1.0, 0.0, 0.0]);
            expect(fixedVec3(frame.up)).toEqual([0.0, 0.0, 1.0]);
            expect(fixedVec3(frame.forward)).toEqual([+0.0, 1.0, -0.0]);

            // Orientation with roll-component
            options.position = MercatorCoordinate.fromLngLat(new LngLat(151.2093, -33.8688));
            options.lookAtPoint(new LngLat(160.0, -33.8688), [0.0, -1.0, 0.1]);
            expect(options.orientation).toBeTruthy();
            frame = rotatedFrame(options.orientation);

            expect(fixedVec3(frame.right)).toEqual([0.0, 1.0, 0.0]);
            expect(fixedVec3(frame.up)).toEqual([0.0, 0.0, 1.0]);
            expect(fixedVec3(frame.forward)).toEqual([1.0, -0.0, -0.0]);

            // Up vector pointing downwards
            options.position = new MercatorCoordinate(0.5, 0.5, 0.5);
            options.lookAtPoint(new LngLat(0.0, 85.051128779806604), [0.0, 0.0, -0.5]);
            expect(options.orientation).toBeTruthy();
            frame = rotatedFrame(options.orientation);

            expect(fixedVec3(frame.right)).toEqual([1.0, 0.0, 0.0]);
            expect(fixedVec3(frame.up)).toEqual([0.0, -cosPi4, cosPi4]);
            expect(fixedVec3(frame.forward)).toEqual([0.0, -cosPi4, -cosPi4]);

            test('invalid input', () => {
                const options = new FreeCameraOptions();

                // Position not set
                options.orientation = [0, 0, 0, 0];
                options.lookAtPoint(new LngLat(0, 0));
                expect(options.orientation).toBeFalsy();

                // Target same as position
                options.orientation = [0, 0, 0, 0];
                options.position = new MercatorCoordinate(0.5, 0.5, 0.0);
                options.lookAtPoint(new LngLat(0, 0));
                expect(options.orientation).toBeFalsy();

                // Camera looking directly down without an explicit up vector
                options.orientation = [0, 0, 0, 0];
                options.position = new MercatorCoordinate(0.5, 0.5, 0.5);
                options.lookAtPoint(new LngLat(0, 0));
                expect(options.orientation).toBeFalsy();

                // Zero length up vector
                options.orientation = [0, 0, 0, 0];
                options.lookAtPoint(new LngLat(0, 0), [0, 0, 0]);
                expect(options.orientation).toBeFalsy();

                // Up vector same as direction
                options.orientation = [0, 0, 0, 0];
                options.lookAtPoint(new LngLat(0, 0), [0, 0, -1]);
                expect(options.orientation).toBeFalsy();
            });
        });

        test('setPitchBearing', () => {
            const options = new FreeCameraOptions();
            const cos60 = fixedNum(Math.cos(60 * Math.PI / 180.0));
            const sin60 = fixedNum(Math.sin(60 * Math.PI / 180.0));
            let frame = null;

            options.setPitchBearing(0, 0);
            expect(options.orientation).toBeTruthy();
            frame = rotatedFrame(options.orientation);
            expect(fixedVec3(frame.right)).toEqual([1, 0, 0]);
            expect(fixedVec3(frame.up)).toEqual([0, -1, 0]);
            expect(fixedVec3(frame.forward)).toEqual([0, 0, -1]);

            options.setPitchBearing(0, 180);
            expect(options.orientation).toBeTruthy();
            frame = rotatedFrame(options.orientation);
            expect(fixedVec3(frame.right)).toEqual([-1, 0, 0]);
            expect(fixedVec3(frame.up)).toEqual([0, 1, 0]);
            expect(fixedVec3(frame.forward)).toEqual([0, 0, -1]);

            options.setPitchBearing(60, 0);
            expect(options.orientation).toBeTruthy();
            frame = rotatedFrame(options.orientation);
            expect(fixedVec3(frame.right)).toEqual([1, 0, 0]);
            expect(fixedVec3(frame.up)).toEqual([0, -cos60, sin60]);
            expect(fixedVec3(frame.forward)).toEqual([0, -sin60, -cos60]);

            options.setPitchBearing(60, -450);
            expect(options.orientation).toBeTruthy();
            frame = rotatedFrame(options.orientation);
            expect(fixedVec3(frame.right)).toEqual([+0, -1, -0]);
            expect(fixedVec3(frame.up)).toEqual([-cos60, 0, sin60]);
            expect(fixedVec3(frame.forward)).toEqual([-sin60, -0, -cos60]);
        });

        test('emits move events', async () => {
            let started, moved, ended;
            const eventData = {data: 'ok'};

            camera
                .on('movestart', (d) => { started = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => { ended = d.data; });

            const options = camera.getFreeCameraOptions();
            options.position.x = 0.2;
            options.position.y = 0.2;
            camera.setFreeCameraOptions(options, eventData);

            expect(started).toEqual('ok');
            expect(moved).toEqual('ok');
            expect(ended).toEqual('ok');
        });

        test('changing orientation emits bearing events', async () => {
            let rotatestarted, rotated, rotateended, pitch;
            const eventData = {data: 'ok'};

            camera
                .on('rotatestart', (d) => { rotatestarted = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('rotateend', (d) => { rotateended = d.data; })
                .on('pitch', (d) => { pitch = d.data; });

            const options = camera.getFreeCameraOptions();
            quat.rotateZ(options.orientation, options.orientation, 0.1);
            camera.setFreeCameraOptions(options, eventData);

            expect(rotatestarted).toEqual('ok');
            expect(rotated).toEqual('ok');
            expect(rotateended).toEqual('ok');
            expect(pitch).toEqual(undefined);
        });

        test('changing orientation emits pitch events', async () => {
            let  pitchstarted, pitch, pitchended, rotated;
            const eventData = {data: 'ok'};

            camera
                .on('pitchstart', (d) => { pitchstarted = d.data; })
                .on('pitch', (d) => { pitch = d.data; })
                .on('pitchend', (d) => { pitchended = d.data; })
                .on('rotate', (d) => { rotated = d.data; });

            const options = camera.getFreeCameraOptions();
            quat.rotateX(options.orientation, options.orientation, -0.1);
            camera.setFreeCameraOptions(options, eventData);

            expect(pitchstarted).toEqual('ok');
            expect(pitch).toEqual('ok');
            expect(pitchended).toEqual('ok');
            expect(rotated).toEqual(undefined);
        });

        test('changing altitude emits zoom events', async () => {
            let zoomstarted, zoom, zoomended;
            const eventData = {data: 'ok'};

            camera
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                .on('zoom', (d) => { zoom = d.data; })
                .on('zoomend', (d) => { zoomended = d.data; });

            const options = camera.getFreeCameraOptions();
            options.position.z *= 0.8;
            camera.setFreeCameraOptions(options, eventData);

            expect(zoomstarted).toEqual('ok');
            expect(zoom).toEqual('ok');
            expect(zoomended).toEqual('ok');
        });
    });
});
