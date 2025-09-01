// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {assertTransitionTime, attachSimulateFrame, createCamera} from './utils';
import {describe, test, expect, vi, equalWithPrecision} from '../../../util/vitest';
import Camera from '../../../../src/ui/camera';
import Transform from '../../../../src/geo/transform';
import browser from '../../../../src/util/browser';
import {fixedLngLat, fixedNum} from '../../../util/fixed';

describe('camera', () => {
    describe('#flyTo', () => {
        test('pans to specified location', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.flyTo({center: [100, 0], animate: false});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 0});
        });

        test('throws on invalid center argument', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            expect(() => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.flyTo({center: 1});
            }).toThrowError(Error);
        });

        test(
            'does not throw when cameras current zoom is sufficiently greater than passed zoom option',
            () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const camera = createCamera({zoom: 22, center: [0, 0]});
                expect(() => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.flyTo({zoom: 10, center: [0, 0]});
                }).not.toThrowError();
            }
        );

        test(
            'does not throw when cameras current zoom is above maxzoom and an offset creates infinite zoom out factor',
            () => {
                const transform = new Transform(0, 20.9999, 0, 60, true);
                transform.resize(512, 512);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
                const camera = attachSimulateFrame(new Camera(transform, {}))
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    .jumpTo({zoom: 21, center: [0, 0]});
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                camera._update = () => {};
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                camera._preloadTiles = () => {};

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                expect(() => camera.flyTo({zoom: 7.5, center: [0, 0], offset: [0, 70]})).not.toThrowError();
            }
        );

        test('zooms to specified level', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.flyTo({zoom: 3.2, animate: false});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(fixedNum(camera.getZoom())).toEqual(3.2);
        });

        test('zooms to integer level without floating point errors', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera({zoom: 0.6});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.flyTo({zoom: 2, animate: false});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getZoom()).toEqual(2);
        });

        test(
            'Zoom out from the same position to the same position with animation',
            async () => {
                const pos = {lng: 0, lat: 0};
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const camera = createCamera({zoom: 20, center: pos});
                const stub = vi.spyOn(browser, 'now');

                await new Promise(resolve => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.once('zoomend', () => {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat(pos));
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        expect(camera.getZoom()).toEqual(19);
                        resolve();
                    });
                    stub.mockImplementation(() => 0);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.flyTo({zoom: 19, center: pos, duration: 2});

                    stub.mockImplementation(() => 3);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.simulateFrame();
                });

            }
        );

        test('rotates to specified bearing', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.flyTo({bearing: 90, animate: false});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getBearing()).toEqual(90);
        });

        test('tilts to specified pitch', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.flyTo({pitch: 45, animate: false});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getPitch()).toEqual(45);
        });

        test('pans and zooms', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.flyTo({center: [100, 0], zoom: 3.2, animate: false});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 0});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(fixedNum(camera.getZoom())).toEqual(3.2);
        });

        test('pans and rotates', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.flyTo({center: [100, 0], bearing: 90, animate: false});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 0});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getBearing()).toEqual(90);
        });

        test('zooms and rotates', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.flyTo({zoom: 3.2, bearing: 90, animate: false});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(fixedNum(camera.getZoom())).toEqual(3.2);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getBearing()).toEqual(90);
        });

        test('pans, zooms, and rotates', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.flyTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, animate: false});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 0});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(fixedNum(camera.getZoom())).toEqual(3.2);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getBearing()).toEqual(90);
        });

        test('noop', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.flyTo({animate: false});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 0, lat: 0});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getZoom()).toEqual(0);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getBearing()).toEqual(0);
        });

        test('noop with offset', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.flyTo({offset: [100, 0], animate: false});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 0, lat: 0});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getZoom()).toEqual(0);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getBearing()).toEqual(0);
        });

        test('pans with specified offset', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.flyTo({center: [100, 0], offset: [100, 0], animate: false});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 29.6875, lat: 0});
        });

        test(
            'pans with specified offset relative to viewport on a rotated camera',
            () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const camera = createCamera({bearing: 180});
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.easeTo({center: [100, 0], offset: [100, 0], animate: false});
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                expect(fixedLngLat(camera.getCenter())).toEqual({lng: 170.3125, lat: 0});
            }
        );

        test(
            'emits move, zoom, rotate, and pitch events, preserving eventData',
            async () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const camera = createCamera();
                let movestarted: any, moved: any, zoomstarted: any, zoomed: any, rotatestarted: any, rotated: any, pitchstarted: any, pitched: any;
                const eventData = {data: 'ok'};

                const movePromise = new Promise(resolve => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    camera
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                        .on('movestart', (d) => { movestarted = d.data; })
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                        .on('move', (d) => { moved = d.data; })
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                        .on('rotate', (d) => { rotated = d.data; })
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                        .on('pitch', (d) => { pitched = d.data; })
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        .on('moveend', function (d) {
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                            expect(this._zooming).toBeFalsy();
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                            expect(this._panning).toBeFalsy();
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                            expect(this._rotating).toBeFalsy();

                            expect(movestarted).toEqual('ok');
                            expect(moved).toEqual('ok');
                            expect(zoomed).toEqual('ok');
                            expect(rotated).toEqual('ok');
                            expect(pitched).toEqual('ok');
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                            expect(d.data).toEqual('ok');
                            resolve();
                        });
                });

                const zoomPromise = new Promise(resolve => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    camera
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                        .on('zoomstart', (d) => { zoomstarted = d.data; })
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                        .on('zoom', (d) => { zoomed = d.data; })
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        .on('zoomend', (d) => {
                            expect(zoomstarted).toEqual('ok');
                            expect(zoomed).toEqual('ok');
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                            expect(d.data).toEqual('ok');
                            resolve();
                        });
                });

                const rotatePromise = new Promise(resolve => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    camera
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                        .on('rotatestart', (d) => { rotatestarted = d.data; })
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                        .on('rotate', (d) => { rotated = d.data; })
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        .on('rotateend', (d) => {
                            expect(rotatestarted).toEqual('ok');
                            expect(rotated).toEqual('ok');
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                            expect(d.data).toEqual('ok');
                            resolve();
                        });
                });

                const pitchPromise = new Promise(resolve => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    camera
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                        .on('pitchstart', (d) => { pitchstarted = d.data; })
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                        .on('pitch', (d) => { pitched = d.data; })
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        .on('pitchend', (d) => {
                            expect(pitchstarted).toEqual('ok');
                            expect(pitched).toEqual('ok');
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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
            // eslint-disable-next-line @typescript-eslint/require-await
            async () => {
                //As I type this, the code path for guiding super-short flights is (and will probably remain) different.
                //As such; it deserves a separate test case. This test case flies the map from A to A.
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const camera = createCamera({center: [100, 0]});
                let movestarted: any, moved: any,
                    zoomstarted: any, zoomed: any, zoomended: any,
                    rotatestarted: any, rotated: any, rotateended: any,
                    pitchstarted: any, pitched: any, pitchended: any;
                const eventData = {data: 'ok'};

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                camera
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                    .on('movestart', (d) => { movestarted = d.data; })
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                    .on('move', (d) => { moved = d.data; })
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                    .on('zoomstart', (d) => { zoomstarted = d.data; })
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                    .on('zoom', (d) => { zoomed = d.data; })
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                    .on('zoomend', (d) => { zoomended = d.data; })
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                    .on('rotatestart', (d) => { rotatestarted = d.data; })
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                    .on('rotate', (d) => { rotated = d.data; })
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                    .on('rotateend', (d) => { rotateended = d.data; })
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                    .on('pitchstart', (d) => { pitchstarted = d.data; })
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                    .on('pitch', (d) => { pitched = d.data; })
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                    .on('pitchend', (d) => { pitchended = d.data; })
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    .on('moveend', function (d) {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        expect(this._zooming).toBeFalsy();
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        expect(this._panning).toBeFalsy();
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        expect(d.data).toEqual('ok');
                    });

                const stub = vi.spyOn(browser, 'now');
                stub.mockImplementation(() => 0);

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.flyTo({center: [100, 0], duration: 10}, eventData);

                setTimeout(() => {
                    stub.mockImplementation(() => 1);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.simulateFrame();

                    setTimeout(() => {
                        stub.mockImplementation(() => 10);
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        camera.simulateFrame();
                    }, 0);
                }, 0);
            }
        );

        test('stops existing ease', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.flyTo({center: [200, 0], duration: 100});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.flyTo({center: [100, 0], duration: 0});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 0});
        });

        test('can be called from within a moveend event handler', async () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            const stub = vi.spyOn(browser, 'now');
            stub.mockImplementation(() => 0);

            await new Promise(resolve => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.flyTo({center: [100, 0], duration: 10});
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.once('moveend', () => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.flyTo({center: [200, 0], duration: 10});
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.once('moveend', () => {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        camera.flyTo({center: [300, 0], duration: 10});
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        camera.once('moveend', () => {
                            resolve();
                        });
                    });
                });

                setTimeout(() => {
                    stub.mockImplementation(() => 10);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.simulateFrame();

                    setTimeout(() => {
                        stub.mockImplementation(() => 20);
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        camera.simulateFrame();

                        setTimeout(() => {
                            stub.mockImplementation(() => 30);
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                            camera.simulateFrame();
                        }, 0);
                    }, 0);
                }, 0);
            });
        });

        test('ascends', async () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.setZoom(18);
            let ascended: any;

            await new Promise(resolve => {

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.on('zoom', () => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    if (camera.getZoom() < 18) {
                        ascended = true;
                    }
                });

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.on('moveend', () => {
                    expect(ascended).toBeTruthy();
                    resolve();
                });

                const stub = vi.spyOn(browser, 'now');
                stub.mockImplementation(() => 0);

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.flyTo({center: [100, 0], zoom: 18, duration: 10});

                setTimeout(() => {
                    stub.mockImplementation(() => 1);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.simulateFrame();

                    setTimeout(() => {
                        stub.mockImplementation(() => 10);
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        camera.simulateFrame();
                    }, 0);
                }, 0);
            });
        });

        test('pans eastward across the prime meridian', async () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            const stub = vi.spyOn(browser, 'now');

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.setCenter([-10, 0]);

            await new Promise(resolve => {

                let crossedPrimeMeridian: any;

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.on('move', () => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    if (Math.abs(camera.getCenter().lng) < 10) {
                        crossedPrimeMeridian = true;
                    }
                });

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.on('moveend', () => {
                    expect(crossedPrimeMeridian).toBeTruthy();
                    resolve();
                });

                stub.mockImplementation(() => 0);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.flyTo({center: [10, 0], duration: 20});

                setTimeout(() => {
                    stub.mockImplementation(() => 1);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.simulateFrame();

                    setTimeout(() => {
                        stub.mockImplementation(() => 20);
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        camera.simulateFrame();
                    }, 0);
                }, 0);
            });
        });

        test('pans westward across the prime meridian', async () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            const stub = vi.spyOn(browser, 'now');

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.setCenter([10, 0]);

            await new Promise(resolve => {
                let crossedPrimeMeridian: any;

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.on('move', () => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    if (Math.abs(camera.getCenter().lng) < 10) {
                        crossedPrimeMeridian = true;
                    }
                });

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.on('moveend', () => {
                    expect(crossedPrimeMeridian).toBeTruthy();
                    resolve();
                });

                stub.mockImplementation(() => 0);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.flyTo({center: [-10, 0], duration: 20});

                setTimeout(() => {
                    stub.mockImplementation(() => 1);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.simulateFrame();

                    setTimeout(() => {
                        stub.mockImplementation(() => 20);
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        camera.simulateFrame();
                    }, 0);
                }, 0);
            });
        });

        test('pans eastward across the antimeridian', async () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            const stub = vi.spyOn(browser, 'now');

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.setCenter([170, 0]);

            await new Promise(resolve => {

                let crossedAntimeridian: any;

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.on('move', () => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    if (camera.getCenter().lng > 170) {
                        crossedAntimeridian = true;
                    }
                });

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.on('moveend', () => {
                    expect(crossedAntimeridian).toBeTruthy();
                    resolve();
                });

                stub.mockImplementation(() => 0);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.flyTo({center: [-170, 0], duration: 20});

                setTimeout(() => {
                    stub.mockImplementation(() => 1);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.simulateFrame();

                    setTimeout(() => {
                        stub.mockImplementation(() => 20);
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        camera.simulateFrame();
                    }, 0);
                }, 0);
            });
        });

        test('pans westward across the antimeridian', async () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            const stub = vi.spyOn(browser, 'now');

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.setCenter([-170, 0]);

            await new Promise(resolve => {

                let crossedAntimeridian: any;

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.on('move', () => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    if (camera.getCenter().lng < -170) {
                        crossedAntimeridian = true;
                    }
                });

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.on('moveend', () => {
                    expect(crossedAntimeridian).toBeTruthy();
                    resolve();
                });

                stub.mockImplementation(() => 0);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.flyTo({center: [170, 0], duration: 10});

                setTimeout(() => {
                    stub.mockImplementation(() => 1);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.simulateFrame();

                    setTimeout(() => {
                        stub.mockImplementation(() => 10);
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        camera.simulateFrame();
                    }, 0);
                }, 0);
            });
        });

        test(
            'does not pan eastward across the antimeridian if no world copies',
            async () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const camera = createCamera({renderWorldCopies: false});
                const stub = vi.spyOn(browser, 'now');

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.setCenter([170, 0]);
                await new Promise(resolve => {

                    let crossedAntimeridian: any;

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.on('move', () => {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        if (camera.getCenter().lng > 170) {
                            crossedAntimeridian = true;
                        }
                    });

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.on('moveend', () => {
                        expect(crossedAntimeridian).toBeFalsy();
                        resolve();
                    });

                    stub.mockImplementation(() => 0);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.flyTo({center: [-170, 0], duration: 10});

                    setTimeout(() => {
                        stub.mockImplementation(() => 1);
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        camera.simulateFrame();

                        setTimeout(() => {
                            stub.mockImplementation(() => 10);
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                            camera.simulateFrame();
                        }, 0);
                    }, 0);
                });
            }
        );

        test(
            'does not pan westward across the antimeridian if no world copies',
            async () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const camera = createCamera({renderWorldCopies: false});
                const stub = vi.spyOn(browser, 'now');

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.setCenter([-170, 0]);
                await new Promise(resolve => {

                    let crossedAntimeridian: any;

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.on('move', () => {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        if (fixedLngLat(camera.getCenter(), 10).lng < -170) {
                            crossedAntimeridian = true;
                        }
                    });

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.on('moveend', () => {
                        expect(crossedAntimeridian).toBeFalsy();
                        resolve();
                    });

                    stub.mockImplementation(() => 0);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.flyTo({center: [170, 0], duration: 10});

                    setTimeout(() => {
                        stub.mockImplementation(() => 1);
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        camera.simulateFrame();

                        setTimeout(() => {
                            stub.mockImplementation(() => 10);
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                            camera.simulateFrame();
                        }, 0);
                    }, 0);
                });
            }
        );

        test('jumps back to world 0 when crossing the antimeridian', async () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            const stub = vi.spyOn(browser, 'now');

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.setCenter([-170, 0]);

            await new Promise(resolve => {

                let leftWorld0 = false;

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.on('move', () => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    leftWorld0 = leftWorld0 || (camera.getCenter().lng < -180);
                });

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.on('moveend', () => {
                    expect(leftWorld0).toBeFalsy();
                    resolve();
                });

                stub.mockImplementation(() => 0);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.flyTo({center: [170, 0], duration: 10});

                setTimeout(() => {
                    stub.mockImplementation(() => 1);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.simulateFrame();

                    setTimeout(() => {
                        stub.mockImplementation(() => 10);
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        camera.simulateFrame();
                    }, 0);
                }, 0);
            });
        });

        test('peaks at the specified zoom level', async () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera({zoom: 20});
            const stub = vi.spyOn(browser, 'now');

            const minZoom = 1;

            await new Promise(resolve => {

                let zoomed = false;

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.on('zoom', () => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    const zoom = camera.getZoom();
                    if (zoom < 1) {
                        expect.unreachable(`${zoom} should be >= ${minZoom} during flyTo`);
                    }

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    if (camera.getZoom() < (minZoom + 1)) {
                        zoomed = true;
                    }
                });

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.on('moveend', () => {
                    // zoom came within satisfactory range of minZoom provided
                    expect(zoomed).toBeTruthy();
                    resolve();
                });

                stub.mockImplementation(() => 0);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.flyTo({center: [1, 0], zoom: 20, minZoom, duration: 10});

                setTimeout(() => {
                    stub.mockImplementation(() => 3);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.simulateFrame();

                    setTimeout(() => {
                        stub.mockImplementation(() => 10);
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        camera.simulateFrame();
                    }, 0);
                }, 0);
            });
        });

        test('respects transform\'s maxZoom', async () => {
            const transform = new Transform(2, 10, 0, 60, false);
            transform.resize(512, 512);

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = attachSimulateFrame(new Camera(transform, {}));
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            camera._update = () => {};
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            camera._preloadTiles = () => {};

            await new Promise(resolve => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.on('moveend', () => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    equalWithPrecision(camera.getZoom(), 10, 1e-10);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    const {lng, lat} = camera.getCenter();
                    equalWithPrecision(lng, 12, 1e-10);
                    equalWithPrecision(lat, 34, 1e-10);

                    resolve();
                });

                const stub = vi.spyOn(browser, 'now');
                stub.mockImplementation(() => 0);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.flyTo({center: [12, 34], zoom: 30, duration: 10});

                setTimeout(() => {
                    stub.mockImplementation(() => 10);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.simulateFrame();
                }, 0);
            });
        });

        test('respects transform\'s minZoom', async () => {
            const transform = new Transform(2, 10, 0, 60, false);
            transform.resize(512, 512);

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = attachSimulateFrame(new Camera(transform, {}));
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            camera._update = () => {};
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            camera._preloadTiles = () => {};

            await new Promise(resolve => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.on('moveend', () => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    equalWithPrecision(camera.getZoom(), 2, 1e-10);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    const {lng, lat} = camera.getCenter();
                    equalWithPrecision(lng, 12, 1e-10);
                    equalWithPrecision(lat, 34, 1e-10);

                    resolve();
                });

                const stub = vi.spyOn(browser, 'now');
                stub.mockImplementation(() => 0);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.flyTo({center: [12, 34], zoom: 1, duration: 10});

                setTimeout(() => {
                    stub.mockImplementation(() => 10);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.simulateFrame();
                }, 0);
            });
        });

        test('resets duration to 0 if it exceeds maxDuration', async () => {
            let startTime: any, endTime: any, timeDiff: any;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera({center: [37.63454, 55.75868], zoom: 18});

            await new Promise(resolve => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                camera
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    .on('movestart', () => { startTime = browser.now(); })
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    .on('moveend', () => {
                        endTime = browser.now();
                        timeDiff = endTime - startTime;
                        equalWithPrecision(timeDiff, 0, 1e+1);
                        resolve();
                    });

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.flyTo({center: [-122.3998631, 37.7884307], maxDuration: 100});
            });
        });

        test('flys instantly when prefers-reduce-motion:reduce is set', async () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            vi.spyOn(browser, 'prefersReducedMotion', 'get').mockImplementation(() => true);
            await assertTransitionTime(camera, 0, 10, () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.flyTo({center: [100, 0], bearing: 90, animate: true});
            });
        });

        test('retain or not padding based on provided padding option', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.flyTo({center: [100, 0], duration: 0, padding: {top: 100}});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getPadding()).toEqual({top: 100, bottom: 0, left: 0, right: 0});

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.flyTo({center: [120, 0], duration: 0, padding: {top: 200}, retainPadding: false});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getPadding()).toEqual({top: 100, bottom: 0, left: 0, right: 0});

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.flyTo({center: [80, 0], duration: 0, padding: {top: 300}, retainPadding: true});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getPadding()).toEqual({top: 300, bottom: 0, left: 0, right: 0});
        });
    });
});
