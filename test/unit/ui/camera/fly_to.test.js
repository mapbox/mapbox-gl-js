import {assertTransitionTime, attachSimulateFrame, createCamera} from './utils.js';
import {describe, test, expect, vi, equalWithPrecision} from '../../../util/vitest.js';
import Camera from '../../../../src/ui/camera.js';
import Transform from '../../../../src/geo/transform.js';
import browser from '../../../../src/util/browser.js';
import {fixedLngLat, fixedNum} from '../../../util/fixed.js';

describe('camera', () => {
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
});
