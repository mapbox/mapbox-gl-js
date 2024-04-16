import {assertTransitionTime, createCamera} from './utils.js';
import {describe, test, expect, vi} from "../../../util/vitest.js";
import browser from '../../../../src/util/browser.js';
import {fixedLngLat} from '../../../util/fixed.js';

describe('camera', () => {
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
});
