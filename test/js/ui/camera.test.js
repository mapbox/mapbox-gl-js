'use strict';

const test = require('mapbox-gl-js-test').test;
const Camera = require('../../../js/ui/camera');
const Transform = require('../../../js/geo/transform');

const fixed = require('mapbox-gl-js-test/fixed');
const fixedLngLat = fixed.LngLat;
const fixedNum = fixed.Num;
const EPSILON = 0.000000001;

test('camera', (t) => {
    function createCamera(cameraOptions) {
        const transform = new Transform(0, 20);
        transform.resize(512, 512);

        const camera = new Camera(transform, {});

        if (cameraOptions) {
            camera.setCamera(cameraOptions);
        }

        return camera;
    }

    t.test('#setCenter, #getCenter', (t) => {
        const camera = createCamera({zoom: 1});

        t.test('sets center', (t) => {
            camera.setCenter([1, 2]);
            t.deepEqual(camera.getCenter(), { lng: 1, lat: 2 });
            t.end();
        });

        t.test('throws on invalid center argument', (t) => {
            t.throws(() => {
                camera.setCenter([1, 'two']);    
            }, Error, 'throws with non-LngLatLike argument');

            t.throws(() => {
                camera.setCenter([1]);
            }, Error, 'throws with non-LngLatLike argument');

            t.throws(() => {
                camera.setCenter(1);
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
            camera.setCamera({center: [3, 4]}, {type: 'ease'});
            t.ok(camera.isEasing());
            camera.setCenter([1, 2]);
            t.ok(!camera.isEasing());
            t.end();
        });

        t.end();
    });

    t.test('#setZoom, #getZoom', (t) => {

        t.test('sets zoom', (t) => {
            const camera = createCamera();
            camera.setZoom(3);
            t.deepEqual(camera.getZoom(), 3);

            camera.setZoom(-1);
            t.equal(camera.getZoom(), 0, 'negative number sets camera to 0');
            t.end();
        });

        t.test('#setZoom fails with invalid input', (t) => {
            const camera = createCamera();
            t.throws(() => {
                camera.setZoom('two');
            }, Error, 'throws with string instead of number');
            t.end();
        });

        t.test('zooms around specified location', (t) => {
            const camera = createCamera();
            camera.setCamera({zoom: 3.2, around: [5, 0]}, {type: 'ease', duration: 1});
            camera.on('moveend', () => {
                t.equal(camera.getZoom(), 3.2);
                t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 4.455905897939886, lat: 0 }));
                t.end();
            });
        });

        t.test('zooms with specified offset', (t) => {
            const camera = createCamera();
            camera.setCamera({zoom: 3.2}, { type: 'ease', offset: [100, 0], duration: 1 });
            camera.on('moveend', () => {
                t.equal(camera.getZoom(), 3.2);
                t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 62.66117668978015, lat: 0 }));
                t.end();
            });
        });

        t.test('zooms with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180});
            camera.setCamera({zoom: 3.2}, { type: 'ease', offset: [100, 0], duration: 1 });
            camera.on('moveend', () => {
                t.equal(camera.getZoom(), 3.2);
                t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: -62.66117668978012, lat: 0 }));
                t.end();
            });
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

            camera.setZoom(5, eventData);
        });

        t.test('cancels in-progress easing', (t) => {
            const camera = createCamera();
            camera.setCamera({center: [3, 4]}, {type: 'ease'});
            t.ok(camera.isEasing());
            camera.setZoom(5);
            t.ok(!camera.isEasing());
            t.end();
        });

        t.end();
    });    

    t.test('#setBearing, #getBearing', (t) => {
        const camera = createCamera();

        t.test('sets bearing', (t) => {
            camera.setBearing(4);
            t.deepEqual(camera.getBearing(), 4);

            camera.setBearing(-10);
            t.equal(camera.getBearing(), -10);
            t.end();
        });

        t.test('#setBearing fails with invalid input', (t) => {
            t.throws(() => {
                camera.setBearing('ten');
            }, Error, 'throws with string instead of number');
            t.end();
        });

        t.test('emits move events, preserving eventData', (t) => {
            let started, moved, ended;
            const eventData = { data: 'ok' };

            camera
                .on('movestart', (d) => { started = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => { ended = d.data; });
            camera.setBearing(4, eventData);
            t.equal(started, 'ok');
            t.equal(moved, 'ok');
            t.equal(ended, 'ok');
            t.end();
        });

        t.test('cancels in-progress easing', (t) => {
            camera.setCamera({center: [3, 4]}, {type: 'ease'});
            t.ok(camera.isEasing());
            camera.setBearing(5);
            t.ok(!camera.isEasing());
            t.end();
        });

        t.end();
    });

    t.test('#setPitch, #getPitch', (t) => {
        const camera = createCamera();

        t.test('#getPitch, #setPitch', (t) => {
            camera.setPitch(5);
            t.equal(camera.getPitch(), 5);

            camera.setBearing(-5);
            t.equal(camera.getBearing(), -5);
            t.end();
        });

        t.test('fails with invalid input', (t) => {
            t.throws(() => {
                camera.setPitch('ten');
            }, Error, 'throws with string instead of number');
            t.end();
        });

        t.test('emits move events, preserving eventData', (t) => {
            let started, moved, ended;
            const eventData = { data: 'ok' };

            camera
                .on('movestart', (d) => { started = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => { ended = d.data; });
            camera.setPitch(4, eventData);
            t.equal(started, 'ok');
            t.equal(moved, 'ok');
            t.equal(ended, 'ok');
            t.end();
        });

        t.test('cancels in-progress easing', (t) => {
            camera.setCamera({center: [3, 4]}, {type: 'ease'});
            t.ok(camera.isEasing());
            camera.setPitch(5);
            t.ok(!camera.isEasing());
            t.end();
        });

        t.end();
    });

    // #setCamera all options individually
    t.test('#setCamera [no animation]', (t) => {
        const camera = createCamera({zoom: 1});

        t.test('sets center', (t) => {
            camera.setCamera({center: [1, 2]});
            t.deepEqual(camera.getCenter(), { lng: 1, lat: 2 });
            t.end();
        });

        t.test('throws on invalid center argument', (t) => {
            t.throws(() => {
                camera.setCamera({center: 1});
            }, Error, 'throws with non-LngLatLike argument');
            t.end();
        });

        t.test('keeps current center if not specified', (t) => {
            camera.setCamera({});
            t.deepEqual(camera.getCenter(), { lng: 1, lat: 2 });
            t.end();
        });

        t.test('sets zoom', (t) => {
            camera.setCamera({zoom: 3});
            t.deepEqual(camera.getZoom(), 3);
            t.end();
        });

        t.test('keeps current zoom if not specified', (t) => {
            camera.setCamera({});
            t.deepEqual(camera.getZoom(), 3);
            t.end();
        });

        t.test('sets bearing', (t) => {
            camera.setCamera({bearing: 4});
            t.deepEqual(camera.getBearing(), 4);
            t.end();
        });

        t.test('keeps current bearing if not specified', (t) => {
            camera.setCamera({});
            t.deepEqual(camera.getBearing(), 4);
            t.end();
        });

        t.test('sets pitch', (t) => {
            camera.setCamera({pitch: 45});
            t.deepEqual(camera.getPitch(), 45);
            t.end();
        });

        t.test('keeps current pitch if not specified', (t) => {
            camera.setCamera({});
            t.deepEqual(camera.getPitch(), 45);
            t.end();
        });

        t.test('sets multiple properties', (t) => {
            camera.setCamera({
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

        t.test('cancels in-progress easing', (t) => {
            camera.setCamera({center: [3, 4]}, {type: 'ease'});
            t.ok(camera.isEasing());
            camera.setCamera({center: [1, 2]});
            t.ok(!camera.isEasing());
            t.end();
        });

        t.end();
    });

    t.test('#setCamera [ease]', (t) => {

        t.test('throws on invalid center argument', (t) => {
            t.throws(() => {
                camera.setCamera({center: 1}, {type: 'ease'});
            }, Error, 'throws with non-LngLatLike argument');
            t.end();
        });

        t.test('animates center/bearing/pitch/zoom', (t) => {
            t.plan(9);
            const camera = createCamera();

            camera.setCamera({
                center: [1, 2], 
                pitch: 20, 
                bearing: 180, 
                zoom: 10
            }, {
                type: 'ease', 
                duration: 20
            });
            setTimeout(() => { // check the center in the middle of animation
                t.ok(camera.getCenter().lng < 1 && camera.getCenter().lat > 0, 'is in between original and final value');
                t.ok(camera.getBearing() < 180 && camera.getBearing() > 0, 'is in between original and final value');
                t.ok(camera.getPitch() < 20 && camera.getPitch() > 0, 'is in between original and final value');
                t.ok(camera.getZoom() < 10 && camera.getZoom() > 0, 'is in between original and final value');
            }, 10);
            camera.on('moveend', () => {
                t.ok(camera.getCenter().lng - 1 < EPSILON, 'is expected final value');
                t.ok(camera.getCenter().lat - 2 < EPSILON, 'is expected final value');
                t.equal(camera.getBearing(), 180, 'is expected final value');
                t.equal(camera.getPitch(), 20, 'is expected final value');
                t.equal(camera.getZoom(), 10, 'is expected final value');
            });
        });

        t.test('keeps center if not specified, just rotate', (t) => {
            t.plan(3);
            const camera = createCamera({center: [1, 2]});

            camera.setCamera({bearing: 180}, {type: 'ease', duration: 1});
            camera.on('moveend', () => {
                t.ok(camera.getCenter().lng - 1 < EPSILON);
                t.ok(camera.getCenter().lat - 2 < EPSILON);
                t.equal(camera.getBearing(), 180);
            });
        });

        t.test('pans with specified offset', (t) => {
            const camera = createCamera();
            camera.setCamera({center: [100, 0]}, {type: 'ease', offset: [100, 0], duration: 1});
            camera.on('moveend', () => {
                t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 29.6875, lat: 0 });
                t.end();
            });
        });

        t.test('pans with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180});
            camera.setCamera({center: [100, 0]}, { type: 'ease', offset: [100, 0], duration: 1 });
            camera.on('moveend', () => {
                t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 170.3125, lat: 0 });
                t.end();    
            });
        });

        t.test('rotates with specified offset', (t) => {
            const camera = createCamera();
            camera.setCamera({bearing: 90}, {type: 'ease', offset: [100, 0], duration: 1});
            camera.on('moveend', () => {
                t.equal(camera.getBearing(), 90);
                t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 70.3125, lat: 0.0000141444 }));
                t.end();
            });
        });

        t.test('rotates with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180});
            camera.setCamera({ bearing: 90 }, {type: 'ease', offset: [100, 0], duration: 1 });
            camera.on('moveend', () => {
                t.equal(camera.getBearing(), 90);
                t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: -70.3125, lat: 0.0000141444 }));
                t.end();
            });
        });

        t.test('another ease function stops a previously existing ease function', (t) => {
            const camera = createCamera();
            camera.setCamera({ center: [200, 0] }, {type: 'ease', duration: 100 });
            camera.setCamera({ center: [100, 0] }, {type: 'ease', duration: 1 });
            camera.on('moveend', () => {
                t.deepEqual(camera.getCenter(), { lng: 100, lat: 0 });
                t.end();
            });
        });

        t.test('can be called from within a moveend event handler', (t) => {
            const camera = createCamera();
            camera.setCamera({ center: [100, 0] }, { type: 'ease', duration: 1 });
            camera.once('moveend', () => {
                camera.setCamera({ center: [200, 0] }, { type: 'ease', duration: 1 });
                camera.once('moveend', () => {
                    camera.setCamera({ center: [300, 0] }, { type: 'ease', duration: 1 });
                    camera.once('moveend', () => {
                        t.end();
                    });
                });
            });
        });

        t.end();
    });

    t.test('#setCamera [fly animation]', (t) => {
        t.test('throws on invalid center argument', (t) => {
            t.throws(() => {
                camera.setCamera({center: 1}, {type: 'fly'});
            }, Error, 'throws with non-LngLatLike argument');
            t.end();
        });

        t.test('correctly uses center, zoom, bearing, and pitch options', (t) => {
            const camera = createCamera();
            camera.setCamera({ center: [100, 0], zoom: 5.5, bearing: 90, pitch: 10 }, {type: 'fly', duration: 1});
            camera.on('moveend', () => {
                t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 100, lat: 0 });
                t.equal(fixedNum(camera.getZoom()), 5.5);
                t.equal(camera.getBearing(), 90);
                t.equal(camera.getPitch(), 10);
                t.end();
            });
        });

        // t.test('noop', (t) => {
        //     const camera = createCamera();
        //     camera.setCamera({}, { type: 'fly', duration: 1 });
        //     camera.on('moveend', () => {
        //         t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 0, lat: 0 });
        //         t.equal(camera.getZoom(), 0);
        //         t.equal(camera.getBearing(), 0);
        //     });
        //     t.end();
        // });

        // t.test('noop with offset', (t) => {
        //     const camera = createCamera();
        //     camera.flyTo({ offset: [100, 0], animate: false });
        //     t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 0, lat: 0 });
        //     t.equal(camera.getZoom(), 0);
        //     t.equal(camera.getBearing(), 0);
        //     t.end();
        // });

        // t.test('pans with specified offset', (t) => {
        //     const camera = createCamera();
        //     camera.flyTo({ center: [100, 0], offset: [100, 0], animate: false });
        //     t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 29.6875, lat: 0 });
        //     t.end();
        // });

        // t.test('pans with specified offset relative to viewport on a rotated camera', (t) => {
        //     const camera = createCamera({ bearing: 180 });
        //     camera.easeTo({ center: [100, 0], offset: [100, 0], animate: false });
        //     t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 170.3125, lat: 0 });
        //     t.end();
        // });

        t.test('another fly animation stops a previously existing fly animation', (t) => {
            const camera = createCamera();
            camera.setCamera({ center: [200, 0] }, {type: 'fly', duration: 100 });
            camera.setCamera({ center: [100, 0] }, {type: 'fly', duration: 1 });
            camera.on('moveend', () => {
                t.ok(camera.getCenter().lng - 100 < EPSILON);
                t.ok(camera.getCenter().lat - 0 < EPSILON);
                t.end();
            });
        });

        t.test('can be called from within a moveend event handler', (t) => {
            const camera = createCamera();
            camera.setCamera({ center: [100, 0] }, { type: 'fly', duration: 1 });
            camera.once('moveend', () => {
                camera.setCamera({ center: [200, 0] }, { type: 'fly', duration: 1 });
                camera.once('moveend', () => {
                    camera.setCamera({ center: [300, 0] }, { type: 'fly', duration: 1 });
                    camera.once('moveend', () => {
                        t.end();
                    });
                });
            });
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

            camera.setCamera({ center: [100, 0], zoom: 18 }, { type: 'fly', duration: 10 });
        });

        t.test('pans eastward across the prime meridian', (t) => {
            const camera = createCamera();
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


            camera.setCamera({ center: [10, 0] }, { type: 'fly', duration: 20 });
        });

        t.test('pans westward across the prime meridian', (t) => {
            const camera = createCamera();
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

            camera.setCamera({ center: [-10, 0] }, { type: 'fly', duration: 20 });
        });

        t.test('pans eastward across the antimeridian', (t) => {
            const camera = createCamera();
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

            camera.setCamera({ center: [-170, 0] }, { type: 'fly', duration: 10 });
        });

        t.test('pans westward across the antimeridian', (t) => {
            const camera = createCamera();
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

            camera.setCamera({ center: [170, 0] }, { type: 'fly', duration: 10 });
        });

        t.test('peaks at the specified zoom level', (t) => {
            const camera = createCamera();
            camera.setZoom(20);
            let minZoom = Infinity;

            camera.on('zoom', () => {
                if (camera.getZoom() < minZoom) {
                    minZoom = camera.getZoom();
                }
            });

            camera.on('moveend', () => {
                t.ok(fixedNum(minZoom, 2) < 1.1);
                t.ok(fixedNum(minZoom, 2) >= 1);
                t.end();
            });

            // turn this up to a second long, to ensure we capture all zoom levels
            camera.setCamera({ center: [1, 0], zoom: 20 }, { type: 'fly', minZoom: 1, duration: 1000 });
        });


        t.end();
    });

    t.test('#getCamera', (t) => {
        const camera = createCamera();
        camera.setCamera({zoom: 2, bearing: 10, pitch: 10, center: [1, 2]});
        const c = camera.getCamera();
        t.equal(c.zoom, 2);
        t.equal(c.bearing, 10);
        t.equal(c.pitch, 10);
        t.deepEqual(c.center, { lng: 1, lat: 2 });
        t.end();
    });

    t.test('#panBy', (t) => {
        t.test('pans by specified amount', (t) => {
            const camera = createCamera();
            camera.panBy([100, 0], {duration: 1});
            camera.on('moveend', () => {
                t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 70.3125, lat: 0 });
                t.end();
            });
        });

        t.test('fails with invalid xy coordinates', (t) => {
            const camera = createCamera();
            t.throws(() => {
                camera.panBy(1, {duration: 1});
            }, Error, 'throws with non PointLike entry');
            t.end();
        });

        t.test('fails with invalid animationOption type: none', (t) => {
            const camera = createCamera();
            t.throws(() => {
                camera.panBy([100, 0], {type: 'none', duration: 1});
            }, Error, 'panBy does not work without an animation');
            t.end();
        });

        t.test('pans relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180});
            camera.panBy([100, 0], { duration: 1 });
            camera.on('moveend', () => {
                t.deepEqual(fixedLngLat(camera.getCenter()), { lng: -70.3125, lat: 0 });
                t.end();
            });
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

            camera.panBy([100, 0], { duration: 1 }, eventData);
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

            camera.panBy([100, 0], { duration: 1, noMoveStart: true });
        });

        t.end();
    });



    // t.test('setCamera around', (t) => {
    //     // around with ease function
    //     // around with flyTo function
    //     // around with bearing/zoom/pitch enacted

    //     t.end();
    // });

    t.test('camera events', (t) => {
        t.test('[no animation], emits move/rotate/zoom/pitch events, preserving eventData', (t) => {
            const camera = createCamera();
            let movestarted, 
                moved,
                zoomed,
                zoomstarted,
                zoomended,
                rotated,
                pitched;
            const eventData = { data: 'ok' };

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                .on('zoomend', (d) => { zoomended = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('pitch', (d) => { pitched = d.data; })
                .on('moveend', (d) => {
                    t.equal(movestarted, 'ok');
                    t.equal(moved, 'ok');
                    t.equal(zoomed, 'ok');
                    t.equal(zoomstarted, 'ok');
                    t.equal(zoomended, 'ok');
                    t.equal(rotated, 'ok');
                    t.equal(pitched, 'ok');
                    t.end();
                });

            camera.setCamera({
                zoom: 2, 
                bearing: 10, 
                pitch: 10, 
                center: [1, 2]
            }, {}, eventData);
        });

        t.test('[no animation], does not emit events if they are not specified', (t) => {
            const camera = createCamera();
            let movestarted, 
                moved,
                zoomed,
                zoomstarted,
                zoomended,
                rotated,
                pitched;
            const eventData = { data: 'ok' };

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                .on('zoomend', (d) => { zoomended = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('pitch', (d) => { pitched = d.data; })
                .on('moveend', (d) => {
                    t.equal(movestarted, 'ok');
                    t.equal(moved, 'ok');
                    t.notOk(zoomed);
                    t.notOk(zoomstarted);
                    t.notOk(zoomended);
                    t.notOk(rotated);
                    t.notOk(pitched);
                    t.end();
                });

            camera.setCamera({}, {}, eventData);
        });

        t.test('[no animation] supresses movestart if noMoveStart option is true', (t) => {
            const camera = createCamera();
            let started;

            camera
                .on('movestart', () => { started = true; })
                .on('moveend', () => {
                    t.ok(!started);
                    t.end();
                });

            camera.setCamera({center: [100, 0]}, { noMoveStart: true });
        });

        t.test('[ease animation], emits move/rotate/zoom/pitch events, preserving eventData', (t) => {
            const camera = createCamera();
            let movestarted, 
                moved,
                zoomed,
                zoomstarted,
                zoomended,
                rotated,
                pitched;
            const eventData = { data: 'ok' };

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                .on('zoomend', (d) => { zoomended = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('pitch', (d) => { pitched = d.data; })
                .on('moveend', (d) => {
                    t.equal(movestarted, 'ok');
                    t.equal(moved, 'ok');
                    t.equal(zoomed, 'ok');
                    t.equal(zoomstarted, 'ok');
                    t.equal(zoomended, 'ok');
                    t.equal(rotated, 'ok');
                    t.equal(pitched, 'ok');
                    t.end();
                });

            camera.setCamera({
                zoom: 2, 
                bearing: 10, 
                pitch: 10, 
                center: [1, 2]
            }, { type: 'ease', duration: 1 }, eventData);
        });

        t.test('[ease animation], does not emit events if they are not specified', (t) => {
            const camera = createCamera();
            let movestarted, 
                moved,
                zoomed,
                zoomstarted,
                zoomended,
                rotated,
                pitched;
            const eventData = { data: 'ok' };

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                .on('zoomend', (d) => { zoomended = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('pitch', (d) => { pitched = d.data; })
                .on('moveend', (d) => {
                    t.equal(movestarted, 'ok');
                    t.equal(moved, 'ok');
                    t.notOk(zoomed);
                    t.notOk(zoomstarted);
                    t.notOk(zoomended);
                    t.notOk(rotated);
                    t.notOk(pitched);
                    t.end();
                });

            camera.setCamera({}, {type: 'ease', duration: 1}, eventData);
        });

        t.test('[ease animation] supresses movestart if noMoveStart option is true', (t) => {
            const camera = createCamera();
            let started;

            camera
                .on('movestart', () => { started = true; })
                .on('moveend', () => {
                    t.ok(!started);
                    t.end();
                });

            camera.setCamera({center: [100, 0]}, { type: 'ease', noMoveStart: true, duration: 1 });
        });

        t.test('[fly animation], emits move/rotate/zoom/pitch events, preserving eventData', (t) => {
            const camera = createCamera();
            let movestarted, 
                moved,
                zoomed,
                zoomstarted,
                zoomended,
                rotated,
                pitched;
            const eventData = { data: 'ok' };

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                .on('zoomend', (d) => { zoomended = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('pitch', (d) => { pitched = d.data; })
                .on('moveend', (d) => {
                    t.equal(movestarted, 'ok');
                    t.equal(moved, 'ok');
                    t.equal(zoomed, 'ok');
                    t.equal(zoomstarted, 'ok');
                    t.equal(zoomended, 'ok');
                    t.equal(rotated, 'ok');
                    t.equal(pitched, 'ok');
                    t.end();
                });

            camera.setCamera({
                zoom: 2, 
                bearing: 10, 
                pitch: 10, 
                center: [1, 2]
            }, { type: 'fly', duration: 1 }, eventData);
        });

        // this fails due to call stack size warnings - related to fly animations failing when the center hasn't changed
        // t.test('[fly animation], does not emit events if they are not specified', (t) => {
        //     const camera = createCamera();
        //     let movestarted, 
        //         moved,
        //         zoomed,
        //         zoomstarted,
        //         zoomended,
        //         rotated,
        //         pitched;
        //     const eventData = { data: 'ok' };

        //     camera
        //         .on('movestart', (d) => { movestarted = d.data; })
        //         .on('move', (d) => { moved = d.data; })
        //         .on('zoom', (d) => { zoomed = d.data; })
        //         .on('zoomstart', (d) => { zoomstarted = d.data; })
        //         .on('zoomend', (d) => { zoomended = d.data; })
        //         .on('rotate', (d) => { rotated = d.data; })
        //         .on('pitch', (d) => { pitched = d.data; })
        //         .on('moveend', (d) => {
        //             t.equal(movestarted, 'ok');
        //             t.equal(moved, 'ok');
        //             t.notOk(zoomed);
        //             t.notOk(zoomstarted);
        //             t.notOk(zoomended);
        //             t.notOk(rotated);
        //             t.notOk(pitched);
        //             t.end();
        //         });

        //     camera.setCamera({}, {type: 'fly', duration: 1}, eventData);
        // });

        t.test('[fly animation] supresses movestart if noMoveStart option is true', (t) => {
            const camera = createCamera();
            let started;

            camera
                .on('movestart', () => { started = true; })
                .on('moveend', () => {
                    t.ok(!started);
                    t.end();
                });

            camera.setCamera({center: [100, 0]}, { type: 'fly', noMoveStart: true, duration: 1 });
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
            camera.on('moveend', () => { t.end(); });
            camera.setCamera({center: [100, 0]}, {type: 'ease', duration: 1});
            t.ok(camera.isEasing());
        });

        t.test('returns false when done panning', (t) => {
            const camera = createCamera();
            camera.on('moveend', () => {
                t.ok(!camera.isEasing());
                t.end();
            });
            camera.setCamera({center: [100, 0]}, {type: 'ease', duration: 1});
        });

        t.test('returns true when zooming', (t) => {
            const camera = createCamera();
            camera.on('moveend', () => {
                t.end();
            });
            camera.setCamera({zoom: 3.2}, {type: 'ease', duration: 1});
            t.ok(camera.isEasing());
        });

        t.test('returns false when done zooming', (t) => {
            const camera = createCamera();
            camera.on('moveend', () => {
                t.ok(!camera.isEasing());
                t.end();
            });
            camera.setCamera({zoom: 3.2}, {type: 'ease', duration: 1});
        });

        t.test('returns true when rotating', (t) => {
            const camera = createCamera();
            camera.on('moveend', () => { t.end(); });
            camera.setCamera({bearing: 90}, {type: 'ease', duration: 1});
            t.ok(camera.isEasing());
        });

        t.test('returns false when done rotating', (t) => {
            const camera = createCamera();
            camera.on('moveend', () => {
                t.ok(!camera.isEasing());
                t.end();
            });
            camera.setCamera({bearing: 90}, {type: 'ease', duration: 1});
        });

        t.end();
    });

    t.test('#stop', (t) => {
        t.test('resets camera.zooming', (t) => {
            const camera = createCamera();
            camera.setCamera({zoom: 3.2}, {type: 'ease', duration: 10});
            camera.stop();
            t.ok(!camera.zooming);
            t.end();
        });

        t.test('resets camera.rotating', (t) => {
            const camera = createCamera();
            camera.setCamera({bearing: 90}, {type: 'ease', duration: 10});
            camera.stop();
            t.ok(!camera.rotating);
            t.end();
        });

        t.test('emits moveend if panning, preserving eventData', (t) => {
            const camera = createCamera();
            const eventData = { data: 'ok' };

            camera.on('moveend', (d) => {
                t.equal(d.data, 'ok');
                t.end();
            });

            camera.setCamera({center: [100, 0]}, {type: 'ease', duration: 10}, eventData);
            camera.stop();
        });

        t.test('emits moveend if zooming, preserving eventData', (t) => {
            const camera = createCamera();
            const eventData = { data: 'ok' };

            camera.on('moveend', (d) => {
                t.equal(d.data, 'ok');
                t.end();
            });

            camera.setCamera({zoom: 3.2}, {type: 'ease', duration: 10}, eventData);
            camera.stop();
        });

        t.test('emits moveend if rotating, preserving eventData', (t) => {
            const camera = createCamera();
            const eventData = { data: 'ok' };

            camera.on('moveend', (d) => {
                t.equal(d.data, 'ok');
                t.end();
            });

            camera.setCamera({bearing: 90}, {type: 'ease', duration: 10}, eventData);
            camera.stop();
        });

        t.test('does not emit moveend if not moving', (t) => {
            const camera = createCamera();
            const eventData = { data: 'ok' };

            camera.on('moveend', (d) => {
                t.ok(d.data, 'ok');
                t.end();
            });

            camera.setCamera({center: [100, 0]}, {}, eventData);
            camera.stop();
        });

        t.end();
    });

    t.test('#cameraForBounds, #getBounds', (t) => {
        t.test('throws on invalid LngLatBoundsLike', (t) => {
            const camera = createCamera();
            t.throws(() => {
                const bounds = camera.cameraForBounds([3, 2]);
            }, Error, 'invalid LngLatBoundsLike');
            t.end();
        });

        t.test('returns proper bounds object', (t) => {
            const camera = createCamera();
            const bounds = camera.cameraForBounds([[-73, 40], [-72, 41]]);
            t.deepEqual(bounds, { 
                padding: 0,
                offset: [ 0, 0 ],
                center: { lng: -72.5, lat: 40.50186340001147 },
                zoom: 8.09664982418688,
                bearing: 0 
            });
            t.end();
        });

        t.test('takes padding into account', (t) => {
            const camera = createCamera();
            const bounds = camera.cameraForBounds([[-73, 40], [-72, 41]], {padding: 10});
            t.deepEqual(bounds, { 
                padding: 10,
                offset: [ 0, 0 ],
                center: { lng: -72.5, lat: 40.50186340001147 },
                zoom: 8.03916432952612,
                bearing: 0 
            });
            t.end();
        });

        t.test('takes offset into account', (t) => {
            const camera = createCamera();
            const bounds = camera.cameraForBounds([[-73, 40], [-72, 41]], {offset: [100, 0]});
            t.deepEqual(bounds, { 
                padding: 0,
                offset: [ 100, 0 ],
                center: { lng: -72.5, lat: 40.50186340001147 },
                zoom: 7.777255315191929,
                bearing: 0
            });
            t.end();
        });

        t.test('#getBounds', (t) => {
            const camera = createCamera({zoom: 0});
            t.deepEqual(parseFloat(camera.getBounds().getCenter().lng.toFixed(10)), 0, 'getBounds');
            t.deepEqual(parseFloat(camera.getBounds().getCenter().lat.toFixed(10)), 0, 'getBounds');

            t.deepEqual(toFixed(camera.getBounds().toArray()), toFixed([
                [ -180.0000000000, -85.0511287798 ],
                [ 180.0000000000, 85.0511287798 ] ]));

            t.test('rotated bounds', (t) => {
                const camera = createCamera({ zoom: 1, bearing: 45 });
                t.deepEqual(
                    toFixed(camera.getBounds().toArray()),
                    toFixed([[-127.2792206136, 0], [127.2792206136, 0]])   
                );
                t.end();
            });
            t.end();

            function toFixed(bounds) {
                const n = 10;
                return [
                    [bounds[0][0].toFixed(n), bounds[0][1].toFixed(n)],
                    [bounds[1][0].toFixed(n), bounds[1][1].toFixed(n)]
                ];
            }
        });

        t.end();
    });

    t.test('#fitBounds', (t) => {
        t.test('throws with invalid bounds', (t) => {
            const camera = createCamera();
            t.throws(() => {
                const bounds = camera.fitBounds([3, 2]);
            }, Error, 'invalid LngLatBoundsLike');
            t.end();
        });

        t.test('no animation', (t) => {
            const camera = createCamera();
            camera.fitBounds([[-73, 40], [-72, 41]]);
            t.deepEqual(camera.getBounds(), {
                _sw: { lng: -73.1575640227109, lat: 39.999999999999886 },
                _ne: { lng: -71.84243597728877, lat: 40.999999999999915 } 
            });
            t.end();
        });

        t.test('ease animation', (t) => {
            const camera = createCamera();
            camera.fitBounds([[-73, 40], [-72, 41]], {}, {type: 'ease', duration: 1});
            camera.on('moveend', () => {
                t.deepEqual(camera.getBounds(), {
                    _sw: { lng: -73.1575640227109, lat: 39.999999999999886 },
                    _ne: { lng: -71.84243597728877, lat: 40.999999999999915 } 
                });
                t.end();
            });
        });

        t.test('fly animation', (t) => {
            const camera = createCamera();
            camera.fitBounds([[-73, 40], [-72, 41]], {}, {type: 'fly', duration: 1});
            camera.on('moveend', () => {
                t.deepEqual(camera.getBounds(), {
                    _sw: { lng: -73.15756402271103, lat: 39.999999999999886 },
                    _ne: { lng: -71.8424359772889, lat: 40.999999999999915 } 
                });
                t.end();
            });
        });

        t.end();
    });
   
    t.end();
});
