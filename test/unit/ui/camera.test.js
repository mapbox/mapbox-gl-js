import { test } from 'mapbox-gl-js-test';
import Camera from '../../../src/ui/camera';
import Transform from '../../../src/geo/transform';
import TaskQueue from '../../../src/util/task_queue';
import browser from '../../../src/util/browser';
import fixed from 'mapbox-gl-js-test/fixed';
const fixedLngLat = fixed.LngLat;
const fixedNum = fixed.Num;

test('camera', (t) => {
    function attachSimulateFrame(camera) {
        const queue = new TaskQueue();
        camera._requestRenderFrame = (cb) => queue.add(cb);
        camera._cancelRenderFrame = (id) => queue.remove(id);
        camera.simulateFrame = () => queue.run();
        return camera;
    }

    function createCamera(options) {
        options = options || {};

        const transform = new Transform(0, 20, options.renderWorldCopies);
        transform.resize(512, 512);

        const camera = attachSimulateFrame(new Camera(transform, {}))
            .jumpTo(options);

        camera._update = () => {};

        return camera;
    }

    t.test('#jumpTo', (t) => {
        // Choose initial zoom to avoid center being constrained by mercator latitude limits.
        const camera = createCamera({zoom: 1});

        t.test('sets center', (t) => {
            camera.jumpTo({center: [1, 2]});
            t.deepEqual(camera.getCenter(), { lng: 1, lat: 2 });
            t.end();
        });

        t.test('throws on invalid center argument', (t) => {
            t.throws(() => {
                camera.jumpTo({center: 1});
            }, Error, 'throws with non-LngLatLike argument');
            t.end();
        });

        t.test('keeps current center if not specified', (t) => {
            camera.jumpTo({});
            t.deepEqual(camera.getCenter(), { lng: 1, lat: 2 });
            t.end();
        });

        t.test('sets zoom', (t) => {
            camera.jumpTo({zoom: 3});
            t.deepEqual(camera.getZoom(), 3);
            t.end();
        });

        t.test('keeps current zoom if not specified', (t) => {
            camera.jumpTo({});
            t.deepEqual(camera.getZoom(), 3);
            t.end();
        });

        t.test('sets bearing', (t) => {
            camera.jumpTo({bearing: 4});
            t.deepEqual(camera.getBearing(), 4);
            t.end();
        });

        t.test('keeps current bearing if not specified', (t) => {
            camera.jumpTo({});
            t.deepEqual(camera.getBearing(), 4);
            t.end();
        });

        t.test('sets pitch', (t) => {
            camera.jumpTo({pitch: 45});
            t.deepEqual(camera.getPitch(), 45);
            t.end();
        });

        t.test('keeps current pitch if not specified', (t) => {
            camera.jumpTo({});
            t.deepEqual(camera.getPitch(), 45);
            t.end();
        });

        t.test('sets multiple properties', (t) => {
            camera.jumpTo({
                center: [10, 20],
                zoom: 10,
                bearing: 180,
                pitch: 60
            });
            t.deepEqual(camera.getCenter(), { lng: 10, lat: 20 });
            t.deepEqual(camera.getZoom(), 10);
            t.deepEqual(camera.getBearing(), 180);
            t.deepEqual(camera.getPitch(), 60);
            t.end();
        });

        t.test('emits move events, preserving eventData', (t) => {
            let started, moved, ended;
            const eventData = { data: 'ok'};

            camera
                .on('movestart', (d) => { started = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => { ended = d.data; });

            camera.jumpTo({center: [1, 2]}, eventData);
            t.equal(started, 'ok');
            t.equal(moved, 'ok');
            t.equal(ended, 'ok');
            t.end();
        });

        t.test('emits zoom events, preserving eventData', (t) => {
            let started, zoomed, ended;
            const eventData = { data: 'ok'};

            camera
                .on('zoomstart', (d) => { started = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomend', (d) => { ended = d.data; });

            camera.jumpTo({zoom: 3}, eventData);
            t.equal(started, 'ok');
            t.equal(zoomed, 'ok');
            t.equal(ended, 'ok');
            t.end();
        });

        t.test('emits rotate events, preserving eventData', (t) => {
            let started, rotated, ended;
            const eventData = { data: 'ok'};

            camera
                .on('rotatestart', (d) => { started = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('rotateend', (d) => { ended = d.data; });

            camera.jumpTo({bearing: 90}, eventData);
            t.equal(started, 'ok');
            t.equal(rotated, 'ok');
            t.equal(ended, 'ok');
            t.end();
        });

        t.test('emits pitch events, preserving eventData', (t)=>{
            let started, pitched, ended;
            const eventData = { data: 'ok'};

            camera
                .on('pitchstart', (d) => { started = d.data; })
                .on('pitch', (d) => { pitched = d.data; })
                .on('pitchend', (d) => { ended = d.data; });

            camera.jumpTo({pitch: 10}, eventData);
            t.equal(started, 'ok');
            t.equal(pitched, 'ok');
            t.equal(ended, 'ok');
            t.end();
        });

        t.test('cancels in-progress easing', (t) => {
            camera.panTo([3, 4]);
            t.ok(camera.isEasing());
            camera.jumpTo({center: [1, 2]});
            t.ok(!camera.isEasing());
            t.end();
        });

        t.end();
    });

    t.test('#setCenter', (t) => {
        // Choose initial zoom to avoid center being constrained by mercator latitude limits.
        const camera = createCamera({zoom: 1});

        t.test('sets center', (t) => {
            camera.setCenter([1, 2]);
            t.deepEqual(camera.getCenter(), { lng: 1, lat: 2 });
            t.end();
        });

        t.test('throws on invalid center argument', (t) => {
            t.throws(() => {
                camera.jumpTo({center: 1});
            }, Error, 'throws with non-LngLatLike argument');
            t.end();
        });

        t.test('emits move events, preserving eventData', (t) => {
            let started, moved, ended;
            const eventData = { data: 'ok'};

            camera.on('movestart', (d) => { started = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => { ended = d.data; });

            camera.setCenter([10, 20], eventData);
            t.equal(started, 'ok');
            t.equal(moved, 'ok');
            t.equal(ended, 'ok');
            t.end();
        });

        t.test('cancels in-progress easing', (t) => {
            camera.panTo([3, 4]);
            t.ok(camera.isEasing());
            camera.setCenter([1, 2]);
            t.ok(!camera.isEasing());
            t.end();
        });

        t.end();
    });

    t.test('#setZoom', (t) => {
        const camera = createCamera();

        t.test('sets zoom', (t) => {
            camera.setZoom(3);
            t.deepEqual(camera.getZoom(), 3);
            t.end();
        });

        t.test('emits move and zoom events, preserving eventData', (t) => {
            let movestarted, moved, moveended, zoomstarted, zoomed, zoomended;
            const eventData = { data: 'ok' };

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => { moveended = d.data; })
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomend', (d) => { zoomended = d.data; });

            camera.setZoom(4, eventData);
            t.equal(movestarted, 'ok');
            t.equal(moved, 'ok');
            t.equal(moveended, 'ok');
            t.equal(zoomstarted, 'ok');
            t.equal(zoomed, 'ok');
            t.equal(zoomended, 'ok');
            t.end();
        });

        t.test('cancels in-progress easing', (t) => {
            camera.panTo([3, 4]);
            t.ok(camera.isEasing());
            camera.setZoom(5);
            t.ok(!camera.isEasing());
            t.end();
        });

        t.end();
    });

    t.test('#setBearing', (t) => {
        const camera = createCamera();

        t.test('sets bearing', (t) => {
            camera.setBearing(4);
            t.deepEqual(camera.getBearing(), 4);
            t.end();
        });

        t.test('emits move and rotate events, preserving eventData', (t) => {
            let movestarted, moved, moveended, rotatestarted, rotated, rotateended;
            const eventData = { data: 'ok' };

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => { moveended = d.data; })
                .on('rotatestart', (d) => { rotatestarted = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('rotateend', (d) => { rotateended = d.data; });

            camera.setBearing(5, eventData);
            t.equal(movestarted, 'ok');
            t.equal(moved, 'ok');
            t.equal(moveended, 'ok');
            t.equal(rotatestarted, 'ok');
            t.equal(rotated, 'ok');
            t.equal(rotateended, 'ok');
            t.end();
        });

        t.test('cancels in-progress easing', (t) => {
            camera.panTo([3, 4]);
            t.ok(camera.isEasing());
            camera.setBearing(6);
            t.ok(!camera.isEasing());
            t.end();
        });

        t.end();
    });

    t.test('#panBy', (t) => {
        t.test('pans by specified amount', (t) => {
            const camera = createCamera();
            camera.panBy([100, 0], { duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 70.3125, lat: 0 });
            t.end();
        });

        t.test('pans relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180});
            camera.panBy([100, 0], { duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: -70.3125, lat: 0 });
            t.end();
        });

        t.test('emits move events, preserving eventData', (t) => {
            const camera = createCamera();
            let started, moved;
            const eventData = { data: 'ok' };

            camera
                .on('movestart', (d) => { started = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => {
                    t.equal(started, 'ok');
                    t.equal(moved, 'ok');
                    t.equal(d.data, 'ok');
                    t.end();
                });

            camera.panBy([100, 0], { duration: 0 }, eventData);
        });

        t.test('supresses movestart if noMoveStart option is true', (t) => {
            const camera = createCamera();
            let started;

            camera
                .on('movestart', () => { started = true; })
                .on('moveend', () => {
                    t.ok(!started);
                    t.end();
                });

            camera.panBy([100, 0], { duration: 0, noMoveStart: true });
        });

        t.end();
    });

    t.test('#panTo', (t) => {
        t.test('pans to specified location', (t) => {
            const camera = createCamera();
            camera.panTo([100, 0], { duration: 0 });
            t.deepEqual(camera.getCenter(), { lng: 100, lat: 0 });
            t.end();
        });

        t.test('throws on invalid center argument', (t) => {
            const camera = createCamera();
            t.throws(() => {
                camera.panTo({center: 1});
            }, Error, 'throws with non-LngLatLike argument');
            t.end();
        });

        t.test('pans with specified offset', (t) => {
            const camera = createCamera();
            camera.panTo([100, 0], { offset: [100, 0], duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 29.6875, lat: 0 });
            t.end();
        });

        t.test('pans with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180});
            camera.panTo([100, 0], { offset: [100, 0], duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 170.3125, lat: 0 });
            t.end();
        });

        t.test('emits move events, preserving eventData', (t) => {
            const camera = createCamera();
            let started, moved;
            const eventData = { data: 'ok' };

            camera
                .on('movestart', (d) => { started = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => {
                    t.equal(started, 'ok');
                    t.equal(moved, 'ok');
                    t.equal(d.data, 'ok');
                    t.end();
                });

            camera.panTo([100, 0], { duration: 0 }, eventData);
        });

        t.test('supresses movestart if noMoveStart option is true', (t) => {
            const camera = createCamera();
            let started;

            camera
                .on('movestart', () => { started = true; })
                .on('moveend', () => {
                    t.ok(!started);
                    t.end();
                });

            camera.panTo([100, 0], { duration: 0, noMoveStart: true });
        });

        t.end();
    });

    t.test('#zoomTo', (t) => {
        t.test('zooms to specified level', (t) => {
            const camera = createCamera();
            camera.zoomTo(3.2, { duration: 0 });
            t.equal(camera.getZoom(), 3.2);
            t.end();
        });

        t.test('zooms around specified location', (t) => {
            const camera = createCamera();
            camera.zoomTo(3.2, { around: [5, 0], duration: 0 });
            t.equal(camera.getZoom(), 3.2);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 4.455905897939886, lat: 0 }));
            t.end();
        });

        t.test('zooms with specified offset', (t) => {
            const camera = createCamera();
            camera.zoomTo(3.2, { offset: [100, 0], duration: 0 });
            t.equal(camera.getZoom(), 3.2);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 62.66117668978015, lat: 0 }));
            t.end();
        });

        t.test('zooms with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180});
            camera.zoomTo(3.2, { offset: [100, 0], duration: 0 });
            t.equal(camera.getZoom(), 3.2);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: -62.66117668978012, lat: 0 }));
            t.end();
        });

        t.test('emits move and zoom events, preserving eventData', (t) => {
            const camera = createCamera();
            let movestarted, moved, zoomstarted, zoomed;
            const eventData = { data: 'ok' };

            t.plan(6);

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => {
                    t.equal(movestarted, 'ok');
                    t.equal(moved, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomend', (d) => {
                    t.equal(zoomstarted, 'ok');
                    t.equal(zoomed, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera.zoomTo(5, { duration: 0 }, eventData);
        });

        t.end();
    });

    t.test('#rotateTo', (t) => {
        t.test('rotates to specified bearing', (t) => {
            const camera = createCamera();
            camera.rotateTo(90, { duration: 0 });
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('rotates around specified location', (t) => {
            const camera = createCamera({ zoom: 3 });
            camera.rotateTo(90, { around: [5, 0], duration: 0 });
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 4.999999999999972, lat: 4.993665859353271 }));
            t.end();
        });

        t.test('rotates around specified location, constrained to fit the view', (t) => {
            const camera = createCamera({ zoom: 0 });
            camera.rotateTo(90, { around: [5, 0], duration: 0 });
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 4.999999999999972, lat: 0.000002552471840999715 }));
            t.end();
        });

        t.test('rotates with specified offset', (t) => {
            const camera = createCamera({ zoom: 1 });
            camera.rotateTo(90, { offset: [200, 0], duration: 0 });
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 70.3125, lat: 57.3265212252 }));
            t.end();
        });

        t.test('rotates with specified offset, constrained to fit the view', (t) => {
            const camera = createCamera({ zoom: 0 });
            camera.rotateTo(90, { offset: [100, 0], duration: 0 });
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 70.3125, lat: 0.000002552471840999715 }));
            t.end();
        });

        t.test('rotates with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({ bearing: 180, zoom: 1 });
            camera.rotateTo(90, { offset: [200, 0], duration: 0 });
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: -70.3125, lat: 57.3265212252 }));
            t.end();
        });

        t.test('emits move and rotate events, preserving eventData', (t) => {
            const camera = createCamera();
            let movestarted, moved, rotatestarted, rotated;
            const eventData = { data: 'ok' };

            t.plan(6);

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => {
                    t.equal(movestarted, 'ok');
                    t.equal(moved, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera
                .on('rotatestart', (d) => { rotatestarted = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('rotateend', (d) => {
                    t.equal(rotatestarted, 'ok');
                    t.equal(rotated, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera.rotateTo(90, { duration: 0 }, eventData);
        });

        t.end();
    });

    t.test('#easeTo', (t) => {
        t.test('pans to specified location', (t) => {
            const camera = createCamera();
            camera.easeTo({ center: [100, 0], duration: 0 });
            t.deepEqual(camera.getCenter(), { lng: 100, lat: 0 });
            t.end();
        });

        t.test('zooms to specified level', (t) => {
            const camera = createCamera();
            camera.easeTo({ zoom: 3.2, duration: 0 });
            t.equal(camera.getZoom(), 3.2);
            t.end();
        });

        t.test('rotates to specified bearing', (t) => {
            const camera = createCamera();
            camera.easeTo({ bearing: 90, duration: 0 });
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('pitches to specified pitch', (t) => {
            const camera = createCamera();
            camera.easeTo({ pitch: 45, duration: 0 });
            t.equal(camera.getPitch(), 45);
            t.end();
        });

        t.test('pans and zooms', (t) => {
            const camera = createCamera();
            camera.easeTo({ center: [100, 0], zoom: 3.2, duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 100, lat: 0 }));
            t.equal(camera.getZoom(), 3.2);
            t.end();
        });

        t.test('zooms around a point', (t) => {
            const camera = createCamera();
            camera.easeTo({ around: [100, 0], zoom: 3, duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 87.5, lat: 0 }));
            t.equal(camera.getZoom(), 3);
            t.end();
        });

        t.test('pans and rotates', (t) => {
            const camera = createCamera();
            camera.easeTo({ center: [100, 0], bearing: 90, duration: 0 });
            t.deepEqual(camera.getCenter(), { lng: 100, lat: 0 });
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('zooms and rotates', (t) => {
            const camera = createCamera();
            camera.easeTo({ zoom: 3.2, bearing: 90, duration: 0 });
            t.equal(camera.getZoom(), 3.2);
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('pans, zooms, and rotates', (t) => {
            const camera = createCamera({bearing: -90});
            camera.easeTo({ center: [100, 0], zoom: 3.2, bearing: 90, duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 100, lat: 0 }));
            t.equal(camera.getZoom(), 3.2);
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('noop', (t) => {
            const camera = createCamera();
            camera.easeTo({ duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 0, lat: 0 });
            t.equal(camera.getZoom(), 0);
            t.equal(camera.getBearing(), 0);
            t.end();
        });

        t.test('noop with offset', (t) => {
            const camera = createCamera();
            camera.easeTo({ offset: [100, 0], duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 0, lat: 0 });
            t.equal(camera.getZoom(), 0);
            t.equal(camera.getBearing(), 0);
            t.end();
        });

        t.test('pans with specified offset', (t) => {
            const camera = createCamera();
            camera.easeTo({ center: [100, 0], offset: [100, 0], duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 29.6875, lat: 0 });
            t.end();
        });

        t.test('pans with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({ bearing: 180 });
            camera.easeTo({ center: [100, 0], offset: [100, 0], duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 170.3125, lat: 0 });
            t.end();
        });

        t.test('zooms with specified offset', (t) => {
            const camera = createCamera();
            camera.easeTo({ zoom: 3.2, offset: [100, 0], duration: 0 });
            t.equal(camera.getZoom(), 3.2);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 62.66117668978015, lat: 0 }));
            t.end();
        });

        t.test('zooms with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180});
            camera.easeTo({ zoom: 3.2, offset: [100, 0], duration: 0 });
            t.equal(camera.getZoom(), 3.2);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: -62.66117668978012, lat: 0 }));
            t.end();
        });

        t.test('rotates with specified offset', (t) => {
            const camera = createCamera();
            camera.easeTo({ bearing: 90, offset: [100, 0], duration: 0 });
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 70.3125, lat: 0.000002552471840999715 }));
            t.end();
        });

        t.test('rotates with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180});
            camera.easeTo({ bearing: 90, offset: [100, 0], duration: 0 });
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: -70.3125, lat: 0.000002552471840999715 }));
            t.end();
        });

        t.test('emits move, zoom, rotate, and pitch events, preserving eventData', (t) => {
            const camera = createCamera();
            let movestarted, moved, zoomstarted, zoomed, rotatestarted, rotated, pitchstarted, pitched;
            const eventData = { data: 'ok' };

            t.plan(18);

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => {
                    t.notOk(camera._zooming);
                    t.notOk(camera._panning);
                    t.notOk(camera._rotating);

                    t.equal(movestarted, 'ok');
                    t.equal(moved, 'ok');
                    t.equal(zoomed, 'ok');
                    t.equal(rotated, 'ok');
                    t.equal(pitched, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomend', (d) => {
                    t.equal(zoomstarted, 'ok');
                    t.equal(zoomed, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera
                .on('rotatestart', (d) => { rotatestarted = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('rotateend', (d) => {
                    t.equal(rotatestarted, 'ok');
                    t.equal(rotated, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera
                .on('pitchstart', (d) => { pitchstarted = d.data; })
                .on('pitch', (d) => { pitched = d.data; })
                .on('pitchend', (d) => {
                    t.equal(pitchstarted, 'ok');
                    t.equal(pitched, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera.easeTo(
                { center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, pitch: 45 },
                eventData);
        });

        t.test('does not emit zoom events if not zooming', (t) => {
            const camera = createCamera();

            camera
                .on('zoomstart', () => { t.fail(); })
                .on('zoom', () => { t.fail(); })
                .on('zoomend', () => { t.fail(); })
                .on('moveend', () => { t.end(); });

            camera.easeTo({center: [100, 0], duration: 0});
        });

        t.test('stops existing ease', (t) => {
            const camera = createCamera();
            camera.easeTo({ center: [200, 0], duration: 100 });
            camera.easeTo({ center: [100, 0], duration: 0 });
            t.deepEqual(camera.getCenter(), { lng: 100, lat: 0 });
            t.end();
        });

        t.test('can be called from within a moveend event handler', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            stub.callsFake(() => 0);
            camera.easeTo({ center: [100, 0], duration: 10 });

            camera.once('moveend', () => {
                camera.easeTo({ center: [200, 0], duration: 10 });
                camera.once('moveend', () => {
                    camera.easeTo({ center: [300, 0], duration: 10 });
                    camera.once('moveend', () => {
                        t.end();
                    });

                    setTimeout(() => {
                        stub.callsFake(() => 30);
                        camera.simulateFrame();
                    }, 0);
                });

                // setTimeout to avoid a synchronous callback
                setTimeout(() => {
                    stub.callsFake(() => 20);
                    camera.simulateFrame();
                }, 0);
            });

            // setTimeout to avoid a synchronous callback
            setTimeout(() => {
                stub.callsFake(() => 10);
                camera.simulateFrame();
            }, 0);
        });

        t.test('pans eastward across the antimeridian', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            camera.setCenter([170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (camera.getCenter().lng > 170) {
                    crossedAntimeridian = true;
                }
            });

            camera.on('moveend', () => {
                t.ok(crossedAntimeridian);
                t.end();
            });

            stub.callsFake(() => 0);
            camera.easeTo({ center: [-170, 0], duration: 10 });

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('pans westward across the antimeridian', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            camera.setCenter([-170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (camera.getCenter().lng < -170) {
                    crossedAntimeridian = true;
                }
            });

            camera.on('moveend', () => {
                t.ok(crossedAntimeridian);
                t.end();
            });

            stub.callsFake(() => 0);
            camera.easeTo({ center: [170, 0], duration: 10 });

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.end();
    });

    t.test('#flyTo', (t) => {
        t.test('pans to specified location', (t) => {
            const camera = createCamera();
            camera.flyTo({ center: [100, 0], animate: false });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 100, lat: 0 });
            t.end();
        });

        t.test('throws on invalid center argument', (t) => {
            const camera = createCamera();
            t.throws(() => {
                camera.flyTo({center: 1});
            }, Error, 'throws with non-LngLatLike argument');
            t.end();
        });

        t.test('does not throw when cameras current zoom is sufficiently greater than passed zoom option', (t)=>{
            const camera = createCamera({zoom: 22, center:[0, 0]});
            t.doesNotThrow(()=>camera.flyTo({zoom:10, center:[0, 0]}));
            t.end();
        });

        t.test('does not throw when cameras current zoom is above maxzoom and an offset creates infinite zoom out factor', (t)=>{
            const transform = new Transform(0, 20.9999, true);
            transform.resize(512, 512);
            const camera = attachSimulateFrame(new Camera(transform, {}))
                .jumpTo({zoom: 21, center:[0, 0]});
            camera._update = () => {};
            t.doesNotThrow(()=>camera.flyTo({zoom:7.5, center:[0, 0], offset:[0, 70]}));
            t.end();
        });

        t.test('zooms to specified level', (t) => {
            const camera = createCamera();
            camera.flyTo({ zoom: 3.2, animate: false });
            t.equal(fixedNum(camera.getZoom()), 3.2);
            t.end();
        });

        t.test('zooms to integer level without floating point errors', (t) => {
            const camera = createCamera({zoom: 0.6});
            camera.flyTo({ zoom: 2, animate: false });
            t.equal(camera.getZoom(), 2);
            t.end();
        });

        t.test('Zoom out from the same position to the same position with animation', (t) => {
            const pos = { lng: 0, lat: 0 };
            const camera = createCamera({zoom: 20, center: pos});
            const stub = t.stub(browser, 'now');

            camera.once('zoomend', () => {
                t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat(pos));
                t.equal(camera.getZoom(), 19);
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({ zoom: 19, center: pos, duration: 2 });

            stub.callsFake(() => 3);
            camera.simulateFrame();
        });

        t.test('rotates to specified bearing', (t) => {
            const camera = createCamera();
            camera.flyTo({ bearing: 90, animate: false });
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('tilts to specified pitch', (t) => {
            const camera = createCamera();
            camera.flyTo({ pitch: 45, animate: false });
            t.equal(camera.getPitch(), 45);
            t.end();
        });

        t.test('pans and zooms', (t) => {
            const camera = createCamera();
            camera.flyTo({ center: [100, 0], zoom: 3.2, animate: false });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 100, lat: 0 });
            t.equal(fixedNum(camera.getZoom()), 3.2);
            t.end();
        });

        t.test('pans and rotates', (t) => {
            const camera = createCamera();
            camera.flyTo({ center: [100, 0], bearing: 90, animate: false });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 100, lat: 0 });
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('zooms and rotates', (t) => {
            const camera = createCamera();
            camera.flyTo({ zoom: 3.2, bearing: 90, animate: false });
            t.equal(fixedNum(camera.getZoom()), 3.2);
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('pans, zooms, and rotates', (t) => {
            const camera = createCamera();
            camera.flyTo({ center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, animate: false });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 100, lat: 0 });
            t.equal(fixedNum(camera.getZoom()), 3.2);
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('noop', (t) => {
            const camera = createCamera();
            camera.flyTo({ animate: false });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 0, lat: 0 });
            t.equal(camera.getZoom(), 0);
            t.equal(camera.getBearing(), 0);
            t.end();
        });

        t.test('noop with offset', (t) => {
            const camera = createCamera();
            camera.flyTo({ offset: [100, 0], animate: false });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 0, lat: 0 });
            t.equal(camera.getZoom(), 0);
            t.equal(camera.getBearing(), 0);
            t.end();
        });

        t.test('pans with specified offset', (t) => {
            const camera = createCamera();
            camera.flyTo({ center: [100, 0], offset: [100, 0], animate: false });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 29.6875, lat: 0 });
            t.end();
        });

        t.test('pans with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({ bearing: 180 });
            camera.easeTo({ center: [100, 0], offset: [100, 0], animate: false });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 170.3125, lat: 0 });
            t.end();
        });

        t.test('emits move, zoom, rotate, and pitch events, preserving eventData', (t) => {
            t.plan(18);

            const camera = createCamera();
            let movestarted, moved, zoomstarted, zoomed, rotatestarted, rotated, pitchstarted, pitched;
            const eventData = { data: 'ok' };

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('pitch', (d) => { pitched = d.data; })
                .on('moveend', function(d) {
                    t.notOk(this._zooming);
                    t.notOk(this._panning);
                    t.notOk(this._rotating);

                    t.equal(movestarted, 'ok');
                    t.equal(moved, 'ok');
                    t.equal(zoomed, 'ok');
                    t.equal(rotated, 'ok');
                    t.equal(pitched, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomend', (d) => {
                    t.equal(zoomstarted, 'ok');
                    t.equal(zoomed, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera
                .on('rotatestart', (d) => { rotatestarted = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('rotateend', (d) => {
                    t.equal(rotatestarted, 'ok');
                    t.equal(rotated, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera
                .on('pitchstart', (d) => { pitchstarted = d.data; })
                .on('pitch', (d) => { pitched = d.data; })
                .on('pitchend', (d) => {
                    t.equal(pitchstarted, 'ok');
                    t.equal(pitched, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera.flyTo(
                { center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, pitch: 45, animate: false },
                eventData);
        });

        t.test('for short flights, emits (solely) move events, preserving eventData', (t) => {
            //As I type this, the code path for guiding super-short flights is (and will probably remain) different.
            //As such; it deserves a separate test case. This test case flies the map from A to A.
            const camera = createCamera({ center: [100, 0] });
            let movestarted, moved,
                zoomstarted, zoomed, zoomended,
                rotatestarted, rotated, rotateended,
                pitchstarted, pitched, pitchended;
            const eventData = { data: 'ok' };

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
                    t.notOk(this._zooming);
                    t.notOk(this._panning);
                    t.notOk(this._rotating);

                    t.equal(movestarted, 'ok');
                    t.equal(moved, 'ok');
                    t.equal(zoomstarted, undefined);
                    t.equal(zoomed, undefined);
                    t.equal(zoomended, undefined);
                    t.equal(rotatestarted, undefined);
                    t.equal(rotated, undefined);
                    t.equal(rotateended, undefined);
                    t.equal(pitched, undefined);
                    t.equal(pitchstarted, undefined);
                    t.equal(pitchended, undefined);
                    t.equal(d.data, 'ok');
                    t.end();
                });

            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);

            camera.flyTo({ center: [100, 0], duration: 10 }, eventData);

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('stops existing ease', (t) => {
            const camera = createCamera();
            camera.flyTo({ center: [200, 0], duration: 100 });
            camera.flyTo({ center: [100, 0], duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 100, lat: 0 });
            t.end();
        });

        t.test('can be called from within a moveend event handler', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);

            camera.flyTo({ center: [100, 0], duration: 10 });
            camera.once('moveend', () => {
                camera.flyTo({ center: [200, 0], duration: 10 });
                camera.once('moveend', () => {
                    camera.flyTo({ center: [300, 0], duration: 10 });
                    camera.once('moveend', () => {
                        t.end();
                    });
                });
            });

            setTimeout(() => {
                stub.callsFake(() => 10);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 20);
                    camera.simulateFrame();

                    setTimeout(() => {
                        stub.callsFake(() => 30);
                        camera.simulateFrame();
                    }, 0);
                }, 0);
            }, 0);
        });

        t.test('ascends', (t) => {
            const camera = createCamera();
            camera.setZoom(18);
            let ascended;

            camera.on('zoom', () => {
                if (camera.getZoom() < 18) {
                    ascended = true;
                }
            });

            camera.on('moveend', () => {
                t.ok(ascended);
                t.end();
            });

            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);

            camera.flyTo({ center: [100, 0], zoom: 18, duration: 10 });

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('pans eastward across the prime meridian', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            camera.setCenter([-10, 0]);
            let crossedPrimeMeridian;

            camera.on('move', () => {
                if (Math.abs(camera.getCenter().lng) < 10) {
                    crossedPrimeMeridian = true;
                }
            });

            camera.on('moveend', () => {
                t.ok(crossedPrimeMeridian);
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({ center: [10, 0], duration: 20 });

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 20);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('pans westward across the prime meridian', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            camera.setCenter([10, 0]);
            let crossedPrimeMeridian;

            camera.on('move', () => {
                if (Math.abs(camera.getCenter().lng) < 10) {
                    crossedPrimeMeridian = true;
                }
            });

            camera.on('moveend', () => {
                t.ok(crossedPrimeMeridian);
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({ center: [-10, 0], duration: 20 });

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 20);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('pans eastward across the antimeridian', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            camera.setCenter([170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (camera.getCenter().lng > 170) {
                    crossedAntimeridian = true;
                }
            });

            camera.on('moveend', () => {
                t.ok(crossedAntimeridian);
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({ center: [-170, 0], duration: 20 });

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 20);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('pans westward across the antimeridian', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            camera.setCenter([-170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (camera.getCenter().lng < -170) {
                    crossedAntimeridian = true;
                }
            });

            camera.on('moveend', () => {
                t.ok(crossedAntimeridian);
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({ center: [170, 0], duration: 10 });

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('does not pan eastward across the antimeridian if no world copies', (t) => {
            const camera = createCamera({renderWorldCopies: false});
            const stub = t.stub(browser, 'now');

            camera.setCenter([170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (camera.getCenter().lng > 170) {
                    crossedAntimeridian = true;
                }
            });

            camera.on('moveend', () => {
                t.notOk(crossedAntimeridian);
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({ center: [-170, 0], duration: 10 });

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('does not pan westward across the antimeridian if no world copies', (t) => {
            const camera = createCamera({renderWorldCopies: false});
            const stub = t.stub(browser, 'now');

            camera.setCenter([-170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (fixedLngLat(camera.getCenter(), 10).lng < -170) {
                    crossedAntimeridian = true;
                }
            });

            camera.on('moveend', () => {
                t.notOk(crossedAntimeridian);
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({ center: [170, 0], duration: 10 });

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('jumps back to world 0 when crossing the antimeridian', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            camera.setCenter([-170, 0]);

            let leftWorld0 = false;

            camera.on('move', () => {
                leftWorld0 = leftWorld0 || (camera.getCenter().lng < -180);
            });

            camera.on('moveend', () => {
                t.false(leftWorld0);
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({ center: [170, 0], duration: 10 });

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('peaks at the specified zoom level', (t) => {
            const camera = createCamera({zoom: 20});
            const stub = t.stub(browser, 'now');

            const minZoom = 1;
            let zoomed = false;

            camera.on('zoom', () => {
                const zoom = camera.getZoom();
                if (zoom < 1) {
                    t.fail(`${zoom} should be >= ${minZoom} during flyTo`);
                }

                if (camera.getZoom() < (minZoom + 1)) {
                    zoomed = true;
                }
            });

            camera.on('moveend', () => {
                t.ok(zoomed, 'zoom came within satisfactory range of minZoom provided');
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({ center: [1, 0], zoom: 20, minZoom, duration: 10 });

            setTimeout(() => {
                stub.callsFake(() => 3);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('respects transform\'s maxZoom', (t) => {
            const transform = new Transform(2, 10, false);
            transform.resize(512, 512);

            const camera = attachSimulateFrame(new Camera(transform, {}));
            camera._update = () => {};

            camera.on('moveend', () => {
                t.equalWithPrecision(camera.getZoom(), 10, 1e-10);
                const { lng, lat } = camera.getCenter();
                t.equalWithPrecision(lng, 12, 1e-10);
                t.equalWithPrecision(lat, 34, 1e-10);

                t.end();
            });

            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);
            camera.flyTo({ center: [12, 34], zoom: 30, duration: 10 });

            setTimeout(() => {
                stub.callsFake(() => 10);
                camera.simulateFrame();
            }, 0);
        });

        t.test('respects transform\'s minZoom', (t) => {
            const transform = new Transform(2, 10, false);
            transform.resize(512, 512);

            const camera = attachSimulateFrame(new Camera(transform, {}));
            camera._update = () => {};

            camera.on('moveend', () => {
                t.equalWithPrecision(camera.getZoom(), 2, 1e-10);
                const { lng, lat } = camera.getCenter();
                t.equalWithPrecision(lng, 12, 1e-10);
                t.equalWithPrecision(lat, 34, 1e-10);

                t.end();
            });

            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);
            camera.flyTo({ center: [12, 34], zoom: 1, duration: 10 });

            setTimeout(() => {
                stub.callsFake(() => 10);
                camera.simulateFrame();
            }, 0);
        });

        t.test('resets duration to 0 if it exceeds maxDuration', (t) => {
            let startTime, endTime, timeDiff;
            const camera = createCamera({ center: [37.63454, 55.75868], zoom: 18});

            camera
                .on('movestart', () => { startTime = new Date(); })
                .on('moveend', () => {
                    endTime = new Date();
                    timeDiff = endTime - startTime;
                    t.equalWithPrecision(timeDiff, 0, 1e+1);
                    t.end();
                });

            camera.flyTo({ center: [-122.3998631, 37.7884307], maxDuration: 100 });
        });

        t.end();
    });

    t.test('#isEasing', (t) => {
        t.test('returns false when not easing', (t) => {
            const camera = createCamera();
            t.ok(!camera.isEasing());
            t.end();
        });

        t.test('returns true when panning', (t) => {
            const camera = createCamera();
            camera.panTo([100, 0], {duration: 1});
            t.ok(camera.isEasing());
            t.end();
        });

        t.test('returns false when done panning', (t) => {
            const camera = createCamera();
            camera.on('moveend', () => {
                t.ok(!camera.isEasing());
                t.end();
            });
            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);
            camera.panTo([100, 0], {duration: 1});
            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();
            }, 0);
        });

        t.test('returns true when zooming', (t) => {
            const camera = createCamera();
            camera.zoomTo(3.2, {duration: 1});
            t.ok(camera.isEasing());
            t.end();
        });

        t.test('returns false when done zooming', (t) => {
            const camera = createCamera();
            camera.on('moveend', () => {
                t.ok(!camera.isEasing());
                t.end();
            });
            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);
            camera.zoomTo(3.2, {duration: 1});
            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();
            }, 0);
        });

        t.test('returns true when rotating', (t) => {
            const camera = createCamera();
            camera.rotateTo(90, {duration: 1});
            t.ok(camera.isEasing());
            t.end();
        });

        t.test('returns false when done rotating', (t) => {
            const camera = createCamera();
            camera.on('moveend', () => {
                t.ok(!camera.isEasing());
                t.end();
            });
            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);
            camera.rotateTo(90, {duration: 1});
            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();
            }, 0);
        });

        t.end();
    });

    t.test('#stop', (t) => {
        t.test('resets camera._zooming', (t) => {
            const camera = createCamera();
            camera.zoomTo(3.2);
            camera.stop();
            t.ok(!camera._zooming);
            t.end();
        });

        t.test('resets camera._rotating', (t) => {
            const camera = createCamera();
            camera.rotateTo(90);
            camera.stop();
            t.ok(!camera._rotating);
            t.end();
        });

        t.test('emits moveend if panning, preserving eventData', (t) => {
            const camera = createCamera();
            const eventData = { data: 'ok' };

            camera.on('moveend', (d) => {
                t.equal(d.data, 'ok');
                t.end();
            });

            camera.panTo([100, 0], {}, eventData);
            camera.stop();
        });

        t.test('emits moveend if zooming, preserving eventData', (t) => {
            const camera = createCamera();
            const eventData = { data: 'ok' };

            camera.on('moveend', (d) => {
                t.equal(d.data, 'ok');
                t.end();
            });

            camera.zoomTo(3.2, {}, eventData);
            camera.stop();
        });

        t.test('emits moveend if rotating, preserving eventData', (t) => {
            const camera = createCamera();
            const eventData = { data: 'ok' };

            camera.on('moveend', (d) => {
                t.equal(d.data, 'ok');
                t.end();
            });

            camera.rotateTo(90, {}, eventData);
            camera.stop();
        });

        t.test('does not emit moveend if not moving', (t) => {
            const camera = createCamera();
            const eventData = { data: 'ok' };

            camera.on('moveend', (d) => {
                t.equal(d.data, 'ok');
                camera.stop();
                t.end(); // Fails with ".end() called twice" if we get here a second time.
            });

            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);
            camera.panTo([100, 0], {duration: 1}, eventData);

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();
            }, 0);
        });

        t.end();
    });

    t.test('#cameraForBounds', (t) => {
        t.test('no padding passed', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb);
            t.deepEqual(fixedLngLat(transform.center, 4), { lng: -100.5, lat: 34.7171 }, 'correctly calculates coordinates for new bounds');
            t.equal(fixedNum(transform.zoom, 3), 2.469);
            t.end();
        });

        t.test('padding number', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, { padding: 15 });
            t.deepEqual(fixedLngLat(transform.center, 4), { lng: -100.5, lat: 34.7171 }, 'correctly calculates coordinates for bounds with padding option as number applied');
            t.equal(fixedNum(transform.zoom, 3), 2.382);
            t.end();
        });

        t.test('padding object', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, { padding: {top: 10, right: 75, bottom: 50, left: 25}, duration: 0 });
            t.deepEqual(fixedLngLat(transform.center, 4), { lng: -100.5, lat: 34.7171 }, 'correctly calculates coordinates for bounds with padding option as object applied');
            t.end();
        });

        t.end();
    });

    t.test('#fitBounds', (t) => {
        t.test('no padding passed', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            camera.fitBounds(bb, {duration:0});
            t.deepEqual(fixedLngLat(camera.getCenter(), 4), { lng: -100.5, lat: 34.7171 }, 'pans to coordinates based on fitBounds');
            t.equal(fixedNum(camera.getZoom(), 3), 2.469);
            t.end();
        });

        t.test('padding number', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            camera.fitBounds(bb, { padding: 15, duration:0 });
            t.deepEqual(fixedLngLat(camera.getCenter(), 4), { lng: -100.5, lat: 34.7171 }, 'pans to coordinates based on fitBounds with padding option as number applied');
            t.equal(fixedNum(camera.getZoom(), 3), 2.382);
            t.end();
        });

        t.test('padding object', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            camera.fitBounds(bb, { padding: {top: 10, right: 75, bottom: 50, left: 25}, duration:0 });
            t.deepEqual(fixedLngLat(camera.getCenter(), 4), { lng: -96.5558, lat: 32.0833 }, 'pans to coordinates based on fitBounds with padding option as object applied');
            t.end();
        });

        t.end();
    });

    t.test('#fitScreenCoordinates', (t) => {
        t.test('bearing 225', (t) => {
            const camera = createCamera();
            const p0 = [128, 128];
            const p1 = [256, 256];
            const bearing = 225;

            camera.fitScreenCoordinates(p0, p1, bearing, {duration:0});
            t.deepEqual(fixedLngLat(camera.getCenter(), 4), { lng: -45, lat: 40.9799 }, 'centers, rotates 225 degrees, and zooms based on screen coordinates');
            t.equal(fixedNum(camera.getZoom(), 3), 1.5);
            t.equal(camera.getBearing(), -135);
            t.end();
        });

        t.test('bearing 0', (t) => {
            const camera = createCamera();

            const p0 = [128, 128];
            const p1 = [256, 256];
            const bearing = 0;

            camera.fitScreenCoordinates(p0, p1, bearing, {duration:0});
            t.deepEqual(fixedLngLat(camera.getCenter(), 4), { lng: -45, lat: 40.9799 }, 'centers and zooms in based on screen coordinates');
            t.equal(fixedNum(camera.getZoom(), 3), 2);
            t.equal(camera.getBearing(), 0);
            t.end();
        });

        t.test('inverted points', (t) => {
            const camera = createCamera();
            const p1 = [128, 128];
            const p0 = [256, 256];
            const bearing = 0;

            camera.fitScreenCoordinates(p0, p1, bearing, {duration:0});
            t.deepEqual(fixedLngLat(camera.getCenter(), 4), { lng: -45, lat: 40.9799 }, 'centers and zooms based on screen coordinates in opposite order');
            t.equal(fixedNum(camera.getZoom(), 3), 2);
            t.equal(camera.getBearing(), 0);
            t.end();
        });

        t.end();
    });


    t.end();
});
