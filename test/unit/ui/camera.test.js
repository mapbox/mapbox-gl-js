import {createCamera} from './camera/utils.js';
import {describe, test, expect, vi} from "../../util/vitest.js";
import browser from '../../../src/util/browser.js';
import {fixedLngLat, fixedNum} from '../../util/fixed.js';
import {LngLatBounds} from '../../../src/geo/lng_lat.js';

describe('camera', () => {
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

        test('entire longitude range: -180 to 180 with asymmetrical padding', () => {
            const camera = createCamera({projection: {name: 'globe'}});
            const bb = [[-180, 10], [180, 50]];

            const transform = camera.cameraForBounds(bb, {padding:{top: 10, right: 75, bottom: 50, left: 25}});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: 180, lat: 80});
            expect(fixedNum(transform.zoom, 3)).toEqual(0.892);
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
});
