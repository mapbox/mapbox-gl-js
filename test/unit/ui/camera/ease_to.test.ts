// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {assertTransitionTime, createCamera} from './utils';
import {describe, test, expect, vi} from '../../../util/vitest';
import browser from '../../../../src/util/browser';
import {fixedLngLat} from '../../../util/fixed';

describe('camera', () => {
    describe('#easeTo', () => {
        test('pans to specified location', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.easeTo({center: [100, 0], duration: 0});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getCenter()).toEqual({lng: 100, lat: 0});
        });

        test('zooms to specified level', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.easeTo({zoom: 3.2, duration: 0});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getZoom()).toEqual(3.2);
        });

        test('rotates to specified bearing', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.easeTo({bearing: 90, duration: 0});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getBearing()).toEqual(90);
        });

        test('pitches to specified pitch', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.easeTo({pitch: 45, duration: 0});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getPitch()).toEqual(45);
        });

        test('pans and zooms', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.easeTo({center: [100, 0], zoom: 3.2, duration: 0});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 100, lat: 0}));
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getZoom()).toEqual(3.2);
        });

        test('zooms around a point', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.easeTo({around: [100, 0], zoom: 3, duration: 0});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 87.5, lat: 0}));
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getZoom()).toEqual(3);
        });

        test('pans and rotates', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.easeTo({center: [100, 0], bearing: 90, duration: 0});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getCenter()).toEqual({lng: 100, lat: 0});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getBearing()).toEqual(90);
        });

        test('zooms and rotates', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.easeTo({zoom: 3.2, bearing: 90, duration: 0});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getZoom()).toEqual(3.2);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getBearing()).toEqual(90);
        });

        test('pans, zooms, and rotates', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera({bearing: -90});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.easeTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 0});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 100, lat: 0}));
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getZoom()).toEqual(3.2);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getBearing()).toEqual(90);
        });

        test('noop', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.easeTo({duration: 0});
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
            camera.easeTo({offset: [100, 0], duration: 0});
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
            camera.easeTo({center: [100, 0], offset: [100, 0], duration: 0});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 29.6875, lat: 0});
        });

        test(
            'pans with specified offset relative to viewport on a rotated camera',
            () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const camera = createCamera({bearing: 180});
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.easeTo({center: [100, 0], offset: [100, 0], duration: 0});
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                expect(fixedLngLat(camera.getCenter())).toEqual({lng: 170.3125, lat: 0});
            }
        );

        test('zooms with specified offset', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.easeTo({zoom: 3.2, offset: [100, 0], duration: 0});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getZoom()).toEqual(3.2);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 62.66117668978015, lat: 0}));
        });

        test(
            'zooms with specified offset relative to viewport on a rotated camera',
            () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const camera = createCamera({bearing: 180});
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.easeTo({zoom: 3.2, offset: [100, 0], duration: 0});
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                expect(camera.getZoom()).toEqual(3.2);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: -62.66117668978012, lat: 0}));
            }
        );

        test('rotates with specified offset', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.easeTo({bearing: 90, offset: [100, 0], duration: 0});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getBearing()).toEqual(90);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 70.3125, lat: 0.000002552471840999715}));
        });

        test(
            'rotates with specified offset relative to viewport on a rotated camera',
            () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const camera = createCamera({bearing: 180});
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.easeTo({bearing: 90, offset: [100, 0], duration: 0});
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                expect(camera.getBearing()).toEqual(90);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: -70.3125, lat: 0.000002552471840999715}));
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
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        .on('moveend', (d) => {
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                            expect(camera._zooming).toBeFalsy();
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                            expect(camera._panning).toBeFalsy();
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                            expect(camera._rotating).toBeFalsy();

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
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.easeTo(
                        {center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, pitch: 45},
                        eventData
                    )
                ]);
            }
        );

        // eslint-disable-next-line @typescript-eslint/require-await
        test('does not emit zoom events if not zooming', async () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            camera
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                .on('zoomstart', () => { expect.unreachable(); })
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                .on('zoom', () => { expect.unreachable(); })
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                .on('zoomend', () => { expect.unreachable(); })
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                .on('moveend', () => {});

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.easeTo({center: [100, 0], duration: 0});
        });

        test('stops existing ease', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.easeTo({center: [200, 0], duration: 100});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.easeTo({center: [100, 0], duration: 0});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getCenter()).toEqual({lng: 100, lat: 0});
        });

        test('can be called from within a moveend event handler', async () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            const stub = vi.spyOn(browser, 'now').mockImplementation(() => 0);

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.easeTo({center: [100, 0], duration: 10});

            await new Promise(resolve => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.once('moveend', () => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.easeTo({center: [200, 0], duration: 10});
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.once('moveend', () => {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        camera.easeTo({center: [300, 0], duration: 10});
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        camera.once('moveend', () => {
                            resolve();
                        });

                        setTimeout(() => {
                            stub.mockImplementation(() => 30);
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                            camera.simulateFrame();
                        }, 0);
                    });

                    // setTimeout to avoid a synchronous callback
                    setTimeout(() => {
                        stub.mockImplementation(() => 20);
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        camera.simulateFrame();
                    }, 0);
                });

                // setTimeout to avoid a synchronous callback
                setTimeout(() => {
                    stub.mockImplementation(() => 10);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.simulateFrame();
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
                camera.easeTo({center: [-170, 0], duration: 10});

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

        test('pans westward across the antimeridian', async () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            const stub = vi.spyOn(browser, 'now');

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.setCenter([-170, 0]);
            let crossedAntimeridian: any;

            await new Promise(resolve => {
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
                camera.easeTo({center: [170, 0], duration: 10});

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
            'animation occurs when prefers-reduced-motion: reduce is set but overridden by essential: true',
            async () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const camera = createCamera();
                vi.spyOn(browser, 'prefersReducedMotion', 'get').mockImplementation(() => true);
                const stubNow = vi.spyOn(browser, 'now');

                // camera transition expected to take in this range when prefersReducedMotion is set and essential: true,
                // when a duration of 200 is requested
                const min = 100;
                const max = 300;

                await new Promise(resolve => {

                    let startTime: any;
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    camera
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        .on('movestart', () => { startTime = browser.now(); })
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        .on('moveend', () => {
                            const endTime = browser.now();
                            const timeDiff = endTime - startTime;
                            expect(timeDiff >= min && timeDiff < max).toBeTruthy();
                            resolve();
                        });

                    setTimeout(() => {
                        stubNow.mockImplementation(() => 0);
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        camera.simulateFrame();

                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        camera.easeTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 200, essential: true});

                        setTimeout(() => {
                            stubNow.mockImplementation(() => 200);
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                            camera.simulateFrame();
                        }, 0);
                    }, 0);
                });
            }
        );

        test(
            'animation occurs when prefers-reduced-motion: reduce is set but overridden by respectPrefersReducedMotion: false',
            async () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const camera = createCamera({respectPrefersReducedMotion: false});

                vi.spyOn(browser, 'prefersReducedMotion', 'get').mockImplementation(() => true);
                const stubNow = vi.spyOn(browser, 'now');

                // camera transition expected to take in this range when prefersReducedMotion is set and essential: true,
                // when a duration of 200 is requested
                const min = 100;
                const max = 300;

                let startTime: any;
                await new Promise(resolve => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    camera
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        .on('movestart', () => { startTime = browser.now(); })
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        .on('moveend', () => {
                            const endTime = browser.now();
                            const timeDiff = endTime - startTime;
                            expect(timeDiff >= min && timeDiff < max).toBeTruthy();
                            resolve();
                        });

                    setTimeout(() => {
                        stubNow.mockImplementation(() => 0);
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        camera.simulateFrame();

                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        camera.easeTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 200});

                        setTimeout(() => {
                            stubNow.mockImplementation(() => 200);
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                            camera.simulateFrame();
                        }, 0);
                    }, 0);
                });

            }
        );

        test('duration is 0 when prefers-reduced-motion: reduce is set', async () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            vi.spyOn(browser, 'prefersReducedMotion', 'get').mockImplementation(() => true);
            await assertTransitionTime(camera, 0, 10, () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.easeTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 1000});
            });
        });

        test('retain or not padding based on provided padding option', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const camera = createCamera();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.easeTo({center: [100, 0], duration: 0, padding: {top: 100}});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getPadding()).toEqual({top: 100, bottom: 0, left: 0, right: 0});

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.easeTo({center: [120, 0], duration: 0, padding: {top: 200}, retainPadding: false});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getPadding()).toEqual({top: 100, bottom: 0, left: 0, right: 0});

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.easeTo({center: [80, 0], duration: 0, padding: {top: 300}, retainPadding: true});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            expect(camera.getPadding()).toEqual({top: 300, bottom: 0, left: 0, right: 0});
        });

        describe('Globe', () => {
            test('pans to specified location', () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const camera = createCamera();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                camera.transform.zoom = 4;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.transform.setProjection({name: 'globe'});

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.easeTo({center: [90, 10], duration: 0});
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                expect(camera.getCenter()).toEqual({lng: 90, lat: 10});
            });

            test('rotate the globe once around its axis', () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const camera = createCamera();
                const stub = vi.spyOn(browser, 'now');
                stub.mockImplementation(() => 0);

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                camera.transform.zoom = 4;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.transform.setProjection({name: 'globe'});

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.easeTo({center: [-180.0, 0], duration: 50, easing: e => e});

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.simulateFrame();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                expect(camera.getCenter()).toEqual({lng: 0, lat: 0});

                stub.mockImplementation(() => 25);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.simulateFrame();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                expect(camera.getCenter()).toEqual({lng: -90, lat: 0});

                stub.mockImplementation(() => 50);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.simulateFrame();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                expect(camera.getCenter()).toEqual({lng: 180, lat: 0});

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.easeTo({center: [0, 0], duration: 50, easing: e => e});

                stub.mockImplementation(() => 75);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.simulateFrame();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                expect(camera.getCenter()).toEqual({lng: 90, lat: 0});

                stub.mockImplementation(() => 100);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.simulateFrame();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                expect(camera.getCenter()).toEqual({lng: 0, lat: 0});
            });

            test('pans with padding', () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const camera = createCamera();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.transform.setProjection({name: 'globe'});

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.easeTo({center: [90, 0], duration: 0, padding: {top: 100}});
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                expect(camera.getCenter()).toEqual({lng: 90, lat: 0});
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                expect(camera.getPadding()).toEqual({top: 100, bottom: 0, left: 0, right: 0});
            });

            test('pans with specified offset and bearing', () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const camera = createCamera();
                const stub = vi.spyOn(browser, 'now');
                stub.mockImplementation(() => 0);

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.transform.setProjection({name: 'globe'});
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.easeTo({center: [170, 0], offset: [100, 0], duration: 2000, bearing: 45});

                for (let i = 1; i <= 10; i++) {
                    stub.mockImplementation(() => i * 200);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.simulateFrame();
                }

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                expect(fixedLngLat(camera.getCenter())).toEqual({lng: 99.6875, lat: 0});
            });

            test('reset north', () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const camera = createCamera();
                const stub = vi.spyOn(browser, 'now');
                stub.mockImplementation(() => 0);

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                camera.transform.zoom = 4;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                camera.transform.bearing = 160;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                camera.transform.pitch = 20;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.transform.setProjection({name: 'globe'});

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.resetNorth({easing: e => e});
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.simulateFrame();

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(camera.transform.bearing).toEqual(160);

                stub.mockImplementation(() => 250);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.simulateFrame();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(camera.transform.bearing).toEqual(120);

                stub.mockImplementation(() => 500);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.simulateFrame();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(camera.transform.bearing).toEqual(80);

                stub.mockImplementation(() => 750);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.simulateFrame();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(camera.transform.bearing).toEqual(40);

                stub.mockImplementation(() => 1000);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.simulateFrame();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(camera.transform.bearing).toEqual(0);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(camera.transform.pitch).toEqual(20);
            });

            test('reset north and pitch', () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const camera = createCamera();
                const stub = vi.spyOn(browser, 'now');
                stub.mockImplementation(() => 0);

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                camera.transform.zoom = 4;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                camera.transform.bearing = 160;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                camera.transform.pitch = 20;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.transform.setProjection({name: 'globe'});

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.resetNorthPitch({easing: e => e});
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.simulateFrame();

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(camera.transform.bearing).toEqual(160);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(camera.transform.pitch).toEqual(20);

                stub.mockImplementation(() => 250);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.simulateFrame();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(camera.transform.bearing).toEqual(120);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(camera.transform.pitch).toEqual(15);

                stub.mockImplementation(() => 500);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.simulateFrame();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(camera.transform.bearing).toEqual(80);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(camera.transform.pitch).toEqual(10);

                stub.mockImplementation(() => 750);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.simulateFrame();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(camera.transform.bearing).toEqual(40);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(camera.transform.pitch).toEqual(5);

                stub.mockImplementation(() => 1000);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.simulateFrame();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(camera.transform.bearing).toEqual(0);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(camera.transform.pitch).toEqual(0);
            });

            test('sets bearing', () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const camera = createCamera();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.transform.setProjection({name: 'globe'});

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.setBearing(4);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                expect(camera.getBearing()).toEqual(4);
            });

            test('sets center', () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const camera = createCamera();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.transform.setProjection({name: 'globe'});
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                camera.transform.zoom = 2;

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.setCenter([1, 2]);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                expect(camera.getCenter()).toEqual({lng: 1, lat: 2});
            });

            test('invoke `panBy` with specific amount', () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const camera = createCamera();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.transform.setProjection({name: 'globe'});

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.panBy([100, 0], {duration: 0});
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                expect(fixedLngLat(camera.getCenter())).toEqual({lng: 70.3125, lat: 0});
            });

            test(
                'invoke `panBy` with specific amount with rotated and pitched camera',
                () => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const camera = createCamera();
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.transform.setProjection({name: 'globe'});
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    camera.transform.bearing = 90;
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    camera.transform.pitch = 45;
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    camera.transform.zoom = 3;

                    // Expect linear movement to both directions
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.panBy([700, 0], {duration: 0});
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    expect(fixedLngLat(camera.getCenter())).toEqual({lng: 0, lat: -52.268157374});

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    camera.panBy([-700, 0], {duration: 0});
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    expect(fixedLngLat(camera.getCenter())).toEqual({lng: 0, lat: 0});
                }
            );

            test('invoke `panTo` with specific amount', () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const camera = createCamera();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.transform.setProjection({name: 'globe'});

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                camera.panTo([100, 0], {duration: 0});
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                expect(camera.getCenter()).toEqual({lng: 100, lat: 0});
            });
        });
    });
});
