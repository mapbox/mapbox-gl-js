'use strict';

var test = require('tap').test;
var Camera = require('../../../js/ui/camera');
var Evented = require('../../../js/util/evented');
var Transform = require('../../../js/geo/transform');
var util = require('../../../js/util/util');
var fixed = require('../../testutil/fixed');
var fixedLngLat = fixed.LngLat;
var fixedNum = fixed.Num;

test('camera', function(t) {
    function createCamera(options) {
        var camera = new Camera();

        var transform = camera.transform = new Transform(0, 20);
        transform.resize(512, 512);

        util.extend(camera, Evented);

        if (options) {
            camera.jumpTo(options);
        }

        return camera;
    }

    t.test('#jumpTo', function(t) {
        // Choose initial zoom to avoid center being constrained by mercator latitude limits.
        var camera = createCamera({zoom: 1});

        t.test('sets center', function(t) {
            camera.jumpTo({center: [1, 2]});
            t.deepEqual(camera.getCenter(), { lng: 1, lat: 2 });
            t.end();
        });

        t.test('keeps current center if not specified', function(t) {
            camera.jumpTo({});
            t.deepEqual(camera.getCenter(), { lng: 1, lat: 2 });
            t.end();
        });

        t.test('sets zoom', function(t) {
            camera.jumpTo({zoom: 3});
            t.deepEqual(camera.getZoom(), 3);
            t.end();
        });

        t.test('keeps current zoom if not specified', function(t) {
            camera.jumpTo({});
            t.deepEqual(camera.getZoom(), 3);
            t.end();
        });

        t.test('sets bearing', function(t) {
            camera.jumpTo({bearing: 4});
            t.deepEqual(camera.getBearing(), 4);
            t.end();
        });

        t.test('keeps current bearing if not specified', function(t) {
            camera.jumpTo({});
            t.deepEqual(camera.getBearing(), 4);
            t.end();
        });

        t.test('sets pitch', function(t) {
            camera.jumpTo({pitch: 45});
            t.deepEqual(camera.getPitch(), 45);
            t.end();
        });

        t.test('keeps current pitch if not specified', function(t) {
            camera.jumpTo({});
            t.deepEqual(camera.getPitch(), 45);
            t.end();
        });

        t.test('sets multiple properties', function(t) {
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

        t.test('emits move events, preserving eventData', function(t) {
            var started, moved, ended,
                eventData = { data: 'ok'};

            camera
                .on('movestart', function(d) { started = d.data; })
                .on('move', function(d) { moved = d.data; })
                .on('moveend', function(d) { ended = d.data; });

            camera.jumpTo({center: [1, 2]}, eventData);
            t.equal(started, 'ok');
            t.equal(moved, 'ok');
            t.equal(ended, 'ok');
            t.end();
        });

        t.test('emits zoom events, preserving eventData', function(t) {
            var started, zoomed, ended,
                eventData = { data: 'ok'};

            camera
                .on('zoomstart', function(d) { started = d.data; })
                .on('zoom', function(d) { zoomed = d.data; })
                .on('zoomend', function(d) { ended = d.data; });

            camera.jumpTo({zoom: 3}, eventData);
            t.equal(started, 'ok');
            t.equal(zoomed, 'ok');
            t.equal(ended, 'ok');
            t.end();
        });

        t.test('cancels in-progress easing', function(t) {
            camera.panTo([3, 4]);
            t.ok(camera.isEasing());
            camera.jumpTo({center: [1, 2]});
            t.ok(!camera.isEasing());
            t.end();
        });

        t.end();
    });

    t.test('#setCenter', function(t) {
        // Choose initial zoom to avoid center being constrained by mercator latitude limits.
        var camera = createCamera({zoom: 1});

        t.test('sets center', function(t) {
            camera.setCenter([1, 2]);
            t.deepEqual(camera.getCenter(), { lng: 1, lat: 2 });
            t.end();
        });

        t.test('emits move events, preserving eventData', function(t) {
            var started, moved, ended,
                eventData = { data: 'ok' };

            camera.on('movestart', function(d) { started = d.data; })
                .on('move', function(d) { moved = d.data; })
                .on('moveend', function(d) { ended = d.data; });

            camera.setCenter([10, 20], eventData);
            t.equal(started, 'ok');
            t.equal(moved, 'ok');
            t.equal(ended, 'ok');
            t.end();
        });

        t.test('cancels in-progress easing', function(t) {
            camera.panTo([3, 4]);
            t.ok(camera.isEasing());
            camera.setCenter([1, 2]);
            t.ok(!camera.isEasing());
            t.end();
        });

        t.end();
    });

    t.test('#setZoom', function(t) {
        var camera = createCamera();

        t.test('sets zoom', function(t) {
            camera.setZoom(3);
            t.deepEqual(camera.getZoom(), 3);
            t.end();
        });

        t.test('emits move and zoom events, preserving eventData', function(t) {
            var movestarted, moved, moveended, zoomstarted, zoomed, zoomended,
                eventData = { data: 'ok' };

            camera
                .on('movestart', function(d) { movestarted = d.data; })
                .on('move', function(d) { moved = d.data; })
                .on('moveend', function(d) { moveended = d.data; })
                .on('zoomstart', function(d) { zoomstarted = d.data; })
                .on('zoom', function(d) { zoomed = d.data; })
                .on('zoomend', function(d) { zoomended = d.data; });

            camera.setZoom(4, eventData);
            t.equal(movestarted, 'ok');
            t.equal(moved, 'ok');
            t.equal(moveended, 'ok');
            t.equal(zoomstarted, 'ok');
            t.equal(zoomed, 'ok');
            t.equal(zoomended, 'ok');
            t.end();
        });

        t.test('cancels in-progress easing', function(t) {
            camera.panTo([3, 4]);
            t.ok(camera.isEasing());
            camera.setZoom(5);
            t.ok(!camera.isEasing());
            t.end();
        });

        t.end();
    });

    t.test('#setBearing', function(t) {
        var camera = createCamera();

        t.test('sets bearing', function(t) {
            camera.setBearing(4);
            t.deepEqual(camera.getBearing(), 4);
            t.end();
        });

        t.test('emits move events, preserving eventData', function(t) {
            var started, moved, ended,
                eventData = { data: 'ok' };

            camera
                .on('movestart', function(d) { started = d.data; })
                .on('move', function(d) { moved = d.data; })
                .on('moveend', function(d) { ended = d.data; });
            camera.setBearing(4, eventData);
            t.equal(started, 'ok');
            t.equal(moved, 'ok');
            t.equal(ended, 'ok');
            t.end();
        });

        t.test('cancels in-progress easing', function(t) {
            camera.panTo([3, 4]);
            t.ok(camera.isEasing());
            camera.setBearing(5);
            t.ok(!camera.isEasing());
            t.end();
        });

        t.end();
    });

    t.test('#panBy', function(t) {
        t.test('pans by specified amount', function(t) {
            var camera = createCamera();
            camera.panBy([100, 0], { duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 70.3125, lat: 0 });
            t.end();
        });

        t.test('pans relative to viewport on a rotated camera', function(t) {
            var camera = createCamera({bearing: 180});
            camera.panBy([100, 0], { duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: -70.3125, lat: 0 });
            t.end();
        });

        t.test('emits move events, preserving eventData', function(t) {
            var camera = createCamera();
            var started, moved,
                eventData = { data: 'ok' };

            camera
                .on('movestart', function(d) { started = d.data; })
                .on('move', function(d) { moved = d.data; })
                .on('moveend', function(d) {
                    t.equal(started, 'ok');
                    t.equal(moved, 'ok');
                    t.equal(d.data, 'ok');
                    t.end();
                });

            camera.panBy([100, 0], { duration: 0 }, eventData);
        });

        t.test('supresses movestart if noMoveStart option is true', function(t) {
            var camera = createCamera();
            var started;

            camera
                .on('movestart', function() { started = true; })
                .on('moveend', function() {
                    t.ok(!started);
                    t.end();
                });

            camera.panBy([100, 0], { duration: 0, noMoveStart: true });
        });

        t.end();
    });

    t.test('#panTo', function(t) {
        t.test('pans to specified location', function(t) {
            var camera = createCamera();
            camera.panTo([100, 0], { duration: 0 });
            t.deepEqual(camera.getCenter(), { lng: 100, lat: 0 });
            t.end();
        });

        t.test('pans with specified offset', function(t) {
            var camera = createCamera();
            camera.panTo([100, 0], { offset: [100, 0], duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 29.6875, lat: 0 });
            t.end();
        });

        t.test('pans with specified offset relative to viewport on a rotated camera', function(t) {
            var camera = createCamera({bearing: 180});
            camera.panTo([100, 0], { offset: [100, 0], duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 170.3125, lat: 0 });
            t.end();
        });

        t.test('emits move events, preserving eventData', function(t) {
            var camera = createCamera();
            var started, moved,
                eventData = { data: 'ok' };

            camera
                .on('movestart', function(d) { started = d.data; })
                .on('move', function(d) { moved = d.data; })
                .on('moveend', function(d) {
                    t.equal(started, 'ok');
                    t.equal(moved, 'ok');
                    t.equal(d.data, 'ok');
                    t.end();
                });

            camera.panTo([100, 0], { duration: 0 }, eventData);
        });

        t.test('supresses movestart if noMoveStart option is true', function(t) {
            var camera = createCamera();
            var started;

            camera
                .on('movestart', function() { started = true; })
                .on('moveend', function() {
                    t.ok(!started);
                    t.end();
                });

            camera.panTo([100, 0], { duration: 0, noMoveStart: true });
        });

        t.end();
    });

    t.test('#zoomTo', function(t) {
        t.test('zooms to specified level', function(t) {
            var camera = createCamera();
            camera.zoomTo(3.2, { duration: 0 });
            t.equal(camera.getZoom(), 3.2);
            t.end();
        });

        t.test('zooms around specified location', function (t) {
            var camera = createCamera();
            camera.zoomTo(3.2, { around: [5, 0], duration: 0 });
            t.equal(camera.getZoom(), 3.2);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 4.455905897939886, lat: 0 }));
            t.end();
        });

        t.test('zooms with specified offset', function(t) {
            var camera = createCamera();
            camera.zoomTo(3.2, { offset: [100, 0], duration: 0 });
            t.equal(camera.getZoom(), 3.2);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 62.66117668978015, lat: 0 }));
            t.end();
        });

        t.test('zooms with specified offset relative to viewport on a rotated camera', function(t) {
            var camera = createCamera({bearing: 180});
            camera.zoomTo(3.2, { offset: [100, 0], duration: 0 });
            t.equal(camera.getZoom(), 3.2);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: -62.66117668978012, lat: 0 }));
            t.end();
        });

        t.test('emits move and zoom events, preserving eventData', function(t) {
            var camera = createCamera();
            var movestarted, moved, zoomstarted, zoomed,
                eventData = { data: 'ok' };

            t.plan(6);

            camera
                .on('movestart', function(d) { movestarted = d.data; })
                .on('move', function(d) { moved = d.data; })
                .on('moveend', function(d) {
                    t.equal(movestarted, 'ok');
                    t.equal(moved, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera
                .on('zoomstart', function(d) { zoomstarted = d.data; })
                .on('zoom', function(d) { zoomed = d.data; })
                .on('zoomend', function(d) {
                    t.equal(zoomstarted, 'ok');
                    t.equal(zoomed, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera.zoomTo(5, { duration: 0 }, eventData);
        });

        t.end();
    });

    t.test('#rotateTo', function(t) {
        t.test('rotates to specified bearing', function(t) {
            var camera = createCamera();
            camera.rotateTo(90, { duration: 0 });
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('rotates around specified location', function (t) {
            var camera = createCamera({ zoom: 3 });
            camera.rotateTo(90, { around: [5, 0], duration: 0 });
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 4.999999999999972, lat: 4.993665859353271 }));
            t.end();
        });

        t.test('rotates around specified location, constrained to fit the view', function (t) {
            var camera = createCamera({ zoom: 0 });
            camera.rotateTo(90, { around: [5, 0], duration: 0 });
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 4.999999999999972, lat: 0.000014144426558004852 }));
            t.end();
        });

        t.test('rotates with specified offset', function(t) {
            var camera = createCamera({ zoom: 1 });
            camera.rotateTo(90, { offset: [200, 0], duration: 0 });
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 70.3125, lat: 57.3265212252 }));
            t.end();
        });

        t.test('rotates with specified offset, constrained to fit the view', function(t) {
            var camera = createCamera({ zoom: 0 });
            camera.rotateTo(90, { offset: [100, 0], duration: 0 });
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 70.3125, lat: 0.000014144426558004852 }));
            t.end();
        });

        t.test('rotates with specified offset relative to viewport on a rotated camera', function(t) {
            var camera = createCamera({ bearing: 180, zoom: 1 });
            camera.rotateTo(90, { offset: [200, 0], duration: 0 });
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: -70.3125, lat: 57.3265212252 }));
            t.end();
        });

        t.test('emits move and rotate events, preserving eventData', function(t) {
            var camera = createCamera();
            var movestarted, moved, rotated,
                eventData = { data: 'ok' };

            camera
                .on('movestart', function(d) { movestarted = d.data; })
                .on('move', function(d) { moved = d.data; })
                .on('rotate', function(d) { rotated = d.data; })
                .on('moveend', function(d) {
                    t.equal(movestarted, 'ok');
                    t.equal(moved, 'ok');
                    t.equal(rotated, 'ok');
                    t.equal(d.data, 'ok');
                    t.end();
                });

            camera.rotateTo(90, { duration: 0 }, eventData);
        });

        t.end();
    });

    t.test('#easeTo', function(t) {
        t.test('pans to specified location', function(t) {
            var camera = createCamera();
            camera.easeTo({ center: [100, 0], duration: 0 });
            t.deepEqual(camera.getCenter(), { lng: 100, lat: 0 });
            t.end();
        });

        t.test('zooms to specified level', function(t) {
            var camera = createCamera();
            camera.easeTo({ zoom: 3.2, duration: 0 });
            t.equal(camera.getZoom(), 3.2);
            t.end();
        });

        t.test('rotates to specified bearing', function(t) {
            var camera = createCamera();
            camera.easeTo({ bearing: 90, duration: 0 });
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('pitches to specified pitch', function(t) {
            var camera = createCamera();
            camera.easeTo({ pitch: 45, duration: 0 });
            t.equal(camera.getPitch(), 45);
            t.end();
        });

        t.test('pans and zooms', function(t) {
            var camera = createCamera();
            camera.easeTo({ center: [100, 0], zoom: 3.2, duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 100, lat: 0 }));
            t.equal(camera.getZoom(), 3.2);
            t.end();
        });

        t.test('zooms around a point', function(t) {
            var camera = createCamera();
            camera.easeTo({ around: [100, 0], zoom: 3, duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 87.5, lat: 0 }));
            t.equal(camera.getZoom(), 3);
            t.end();
        });

        t.test('pans and rotates', function(t) {
            var camera = createCamera();
            camera.easeTo({ center: [100, 0], bearing: 90, duration: 0 });
            t.deepEqual(camera.getCenter(), { lng: 100, lat: 0 });
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('zooms and rotates', function(t) {
            var camera = createCamera();
            camera.easeTo({ zoom: 3.2, bearing: 90, duration: 0 });
            t.equal(camera.getZoom(), 3.2);
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('pans, zooms, and rotates', function(t) {
            var camera = createCamera({bearing: -90});
            camera.easeTo({ center: [100, 0], zoom: 3.2, bearing: 90, duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 100, lat: 0 }));
            t.equal(camera.getZoom(), 3.2);
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('noop', function(t) {
            var camera = createCamera();
            camera.easeTo({ duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 0, lat: 0 });
            t.equal(camera.getZoom(), 0);
            t.equal(camera.getBearing(), 0);
            t.end();
        });

        t.test('noop with offset', function(t) {
            var camera = createCamera();
            camera.easeTo({ offset: [100, 0], duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 0, lat: 0 });
            t.equal(camera.getZoom(), 0);
            t.equal(camera.getBearing(), 0);
            t.end();
        });

        t.test('pans with specified offset', function(t) {
            var camera = createCamera();
            camera.easeTo({ center: [100, 0], offset: [100, 0], duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 29.6875, lat: 0 });
            t.end();
        });

        t.test('pans with specified offset relative to viewport on a rotated camera', function(t) {
            var camera = createCamera({ bearing: 180 });
            camera.easeTo({ center: [100, 0], offset: [100, 0], duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 170.3125, lat: 0 });
            t.end();
        });

        t.test('zooms with specified offset', function(t) {
            var camera = createCamera();
            camera.easeTo({ zoom: 3.2, offset: [100, 0], duration: 0 });
            t.equal(camera.getZoom(), 3.2);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 62.66117668978015, lat: 0 }));
            t.end();
        });

        t.test('zooms with specified offset relative to viewport on a rotated camera', function(t) {
            var camera = createCamera({bearing: 180});
            camera.easeTo({ zoom: 3.2, offset: [100, 0], duration: 0 });
            t.equal(camera.getZoom(), 3.2);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: -62.66117668978012, lat: 0 }));
            t.end();
        });

        t.test('rotates with specified offset', function(t) {
            var camera = createCamera();
            camera.easeTo({ bearing: 90, offset: [100, 0], duration: 0 });
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 70.3125, lat: 0.0000141444 }));
            t.end();
        });

        t.test('rotates with specified offset relative to viewport on a rotated camera', function(t) {
            var camera = createCamera({bearing: 180});
            camera.easeTo({ bearing: 90, offset: [100, 0], duration: 0 });
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: -70.3125, lat: 0.0000141444 }));
            t.end();
        });

        t.test('emits move, zoom, rotate, and pitch events, preserving eventData', function(t) {
            var camera = createCamera();
            var movestarted, moved, rotated, pitched, zoomstarted, zoomed,
                eventData = { data: 'ok' };

            t.plan(9);

            camera
                .on('movestart', function(d) { movestarted = d.data; })
                .on('move', function(d) { moved = d.data; })
                .on('rotate', function(d) { rotated = d.data; })
                .on('pitch', function(d) { pitched = d.data; })
                .on('moveend', function(d) {
                    t.equal(movestarted, 'ok');
                    t.equal(moved, 'ok');
                    t.equal(zoomed, 'ok');
                    t.equal(rotated, 'ok');
                    t.equal(pitched, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera
                .on('zoomstart', function(d) { zoomstarted = d.data; })
                .on('zoom', function(d) { zoomed = d.data; })
                .on('zoomend', function(d) {
                    t.equal(zoomstarted, 'ok');
                    t.equal(zoomed, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera.easeTo(
                { center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, pitch: 45 },
                eventData);
        });

        t.test('does not emit zoom events if not zooming', function(t) {
            var camera = createCamera();

            camera
                .on('zoomstart', function() { t.fail(); })
                .on('zoom', function() { t.fail(); })
                .on('zoomend', function() { t.fail(); })
                .on('moveend', function () { t.end(); });

            camera.easeTo({center: [100, 0], duration: 0});
        });

        t.test('stops existing ease', function(t) {
            var camera = createCamera();
            camera.easeTo({ center: [200, 0], duration: 100 });
            camera.easeTo({ center: [100, 0], duration: 0 });
            t.deepEqual(camera.getCenter(), { lng: 100, lat: 0 });
            t.end();
        });

        t.test('can be called from within a moveend event handler', function(t) {
            var camera = createCamera();
            camera.easeTo({ center: [100, 0], duration: 10 });
            camera.once('moveend', function() {
                camera.easeTo({ center: [200, 0], duration: 10 });
                camera.once('moveend', function() {
                    camera.easeTo({ center: [300, 0], duration: 10 });
                    camera.once('moveend', function() {
                        t.end();
                    });
                });
            });
        });

        t.end();
    });

    t.test('#flyTo', function(t) {
        t.test('pans to specified location', function(t) {
            var camera = createCamera();
            camera.flyTo({ center: [100, 0], animate: false });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 100, lat: 0 });
            t.end();
        });

        t.test('zooms to specified level', function(t) {
            var camera = createCamera();
            camera.flyTo({ zoom: 3.2, animate: false });
            t.equal(fixedNum(camera.getZoom()), 3.2);
            t.end();
        });

        t.test('rotates to specified bearing', function(t) {
            var camera = createCamera();
            camera.flyTo({ bearing: 90, animate: false });
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('tilts to specified pitch', function(t) {
            var camera = createCamera();
            camera.flyTo({ pitch: 45, animate: false });
            t.equal(camera.getPitch(), 45);
            t.end();
        });

        t.test('pans and zooms', function(t) {
            var camera = createCamera();
            camera.flyTo({ center: [100, 0], zoom: 3.2, animate: false });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 100, lat: 0 });
            t.equal(fixedNum(camera.getZoom()), 3.2);
            t.end();
        });

        t.test('pans and rotates', function(t) {
            var camera = createCamera();
            camera.flyTo({ center: [100, 0], bearing: 90, animate: false });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 100, lat: 0 });
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('zooms and rotates', function(t) {
            var camera = createCamera();
            camera.flyTo({ zoom: 3.2, bearing: 90, animate: false });
            t.equal(fixedNum(camera.getZoom()), 3.2);
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('pans, zooms, and rotates', function(t) {
            var camera = createCamera();
            camera.flyTo({ center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, animate: false });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 100, lat: 0 });
            t.equal(fixedNum(camera.getZoom()), 3.2);
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('noop', function(t) {
            var camera = createCamera();
            camera.flyTo({ animate: false });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 0, lat: 0 });
            t.equal(camera.getZoom(), 0);
            t.equal(camera.getBearing(), 0);
            t.end();
        });

        t.test('noop with offset', function(t) {
            var camera = createCamera();
            camera.flyTo({ offset: [100, 0], animate: false });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 0, lat: 0 });
            t.equal(camera.getZoom(), 0);
            t.equal(camera.getBearing(), 0);
            t.end();
        });

        t.test('pans with specified offset', function(t) {
            var camera = createCamera();
            camera.flyTo({ center: [100, 0], offset: [100, 0], animate: false });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 29.6875, lat: 0 });
            t.end();
        });

        t.test('pans with specified offset relative to viewport on a rotated camera', function(t) {
            var camera = createCamera({ bearing: 180 });
            camera.easeTo({ center: [100, 0], offset: [100, 0], animate: false });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 170.3125, lat: 0 });
            t.end();
        });

        t.test('emits move, zoom, rotate, and pitch events, preserving eventData', function(t) {
            var camera = createCamera();
            var movestarted, moved, rotated, pitched, zoomstarted, zoomed,
                count = 0, eventData = { data: 'ok' };

            camera
                .on('movestart', function(d) { movestarted = d.data; })
                .on('move', function(d) { moved = d.data; })
                .on('rotate', function(d) { rotated = d.data; })
                .on('pitch', function(d) { pitched = d.data; })
                .on('moveend', function(d) {
                    t.equal(movestarted, 'ok');
                    t.equal(moved, 'ok');
                    t.equal(zoomed, 'ok');
                    t.equal(rotated, 'ok');
                    t.equal(pitched, 'ok');
                    t.equal(d.data, 'ok');
                    if (++count === 2) t.end();
                });

            camera
                .on('zoomstart', function(d) { zoomstarted = d.data; })
                .on('zoom', function(d) { zoomed = d.data; })
                .on('zoomend', function(d) {
                    t.equal(zoomstarted, 'ok');
                    t.equal(zoomed, 'ok');
                    t.equal(d.data, 'ok');
                    if (++count === 2) t.end();
                });

            camera.flyTo(
                { center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, pitch: 45, animate: false },
                eventData);
        });

        t.test('stops existing ease', function(t) {
            var camera = createCamera();
            camera.flyTo({ center: [200, 0], duration: 100 });
            camera.flyTo({ center: [100, 0], duration: 0 });
            t.deepEqual(fixedLngLat(camera.getCenter()), { lng: 100, lat: 0 });
            t.end();
        });

        t.test('can be called from within a moveend event handler', function(t) {
            var camera = createCamera();
            camera.flyTo({ center: [100, 0], duration: 10 });
            camera.once('moveend', function() {
                camera.flyTo({ center: [200, 0], duration: 10 });
                camera.once('moveend', function() {
                    camera.flyTo({ center: [300, 0], duration: 10 });
                    camera.once('moveend', function() {
                        t.end();
                    });
                });
            });
        });

        t.test('ascends', function(t) {
            var camera = createCamera();
            camera.setZoom(18);
            var ascended;

            camera.on('zoom', function() {
                if (camera.getZoom() < 18) {
                    ascended = true;
                }
            });

            camera.on('moveend', function() {
                t.ok(ascended);
                t.end();
            });

            camera.flyTo({ center: [100, 0], zoom: 18, duration: 10 });
        });

        t.test('pans eastward across the prime meridian', function(t) {
            var camera = createCamera();
            camera.setCenter([-10, 0]);
            var crossedPrimeMeridian;

            camera.on('move', function() {
                if (Math.abs(camera.getCenter().lng) < 10) {
                    crossedPrimeMeridian = true;
                }
            });

            camera.on('moveend', function() {
                t.ok(crossedPrimeMeridian);
                t.end();
            });

            camera.flyTo({ center: [10, 0], duration: 20 });
        });

        t.test('pans westward across the prime meridian', function(t) {
            var camera = createCamera();
            camera.setCenter([10, 0]);
            var crossedPrimeMeridian;

            camera.on('move', function() {
                if (Math.abs(camera.getCenter().lng) < 10) {
                    crossedPrimeMeridian = true;
                }
            });

            camera.on('moveend', function() {
                t.ok(crossedPrimeMeridian);
                t.end();
            });

            camera.flyTo({ center: [-10, 0], duration: 20 });
        });

        t.test('pans eastward across the antimeridian', function(t) {
            var camera = createCamera();
            camera.setCenter([170, 0]);
            var crossedAntimeridian;

            camera.on('move', function() {
                if (camera.getCenter().lng > 170) {
                    crossedAntimeridian = true;
                }
            });

            camera.on('moveend', function() {
                t.ok(crossedAntimeridian);
                t.end();
            });

            camera.flyTo({ center: [-170, 0], duration: 10 });
        });

        t.test('pans westward across the antimeridian', function(t) {
            var camera = createCamera();
            camera.setCenter([-170, 0]);
            var crossedAntimeridian;

            camera.on('move', function() {
                if (camera.getCenter().lng < -170) {
                    crossedAntimeridian = true;
                }
            });

            camera.on('moveend', function() {
                t.ok(crossedAntimeridian);
                t.end();
            });

            camera.flyTo({ center: [170, 0], duration: 10 });
        });

        t.test('peaks at the specified zoom level', function(t) {
            var camera = createCamera();
            camera.setZoom(20);
            var minZoom = Infinity;

            camera.on('zoom', function() {
                if (camera.getZoom() < minZoom) {
                    minZoom = camera.getZoom();
                }
            });

            camera.on('moveend', function() {
                t.ok(fixedNum(minZoom, 2) < 1.1);
                t.ok(fixedNum(minZoom, 2) >= 1);
                t.end();
            });

            camera.flyTo({ center: [1, 0], zoom: 20, minZoom: 1 });
        });

        t.end();
    });

    t.test('#isEasing', function(t) {
        t.test('returns false when not easing', function(t) {
            var camera = createCamera();
            t.ok(!camera.isEasing());
            t.end();
        });

        t.test('returns true when panning', function(t) {
            var camera = createCamera();
            camera.on('moveend', function() { t.end(); });
            camera.panTo([100, 0], {duration: 1});
            t.ok(camera.isEasing());
        });

        t.test('returns false when done panning', function(t) {
            var camera = createCamera();
            camera.on('moveend', function() {
                t.ok(!camera.isEasing());
                t.end();
            });
            camera.panTo([100, 0], {duration: 1});
        });

        t.test('returns true when zooming', function(t) {
            var camera = createCamera();
            camera.on('moveend', function() {
                t.end();
            });
            camera.zoomTo(3.2, {duration: 1});
            t.ok(camera.isEasing());
        });

        t.test('returns false when done zooming', function(t) {
            var camera = createCamera();
            camera.on('moveend', function() {
                t.ok(!camera.isEasing());
                t.end();
            });
            camera.zoomTo(3.2, {duration: 1});
        });

        t.test('returns true when rotating', function(t) {
            var camera = createCamera();
            camera.on('moveend', function() { t.end(); });
            camera.rotateTo(90, {duration: 1});
            t.ok(camera.isEasing());
        });

        t.test('returns false when done rotating', function(t) {
            var camera = createCamera();
            camera.on('moveend', function() {
                t.ok(!camera.isEasing());
                t.end();
            });
            camera.rotateTo(90, {duration: 1});
        });

        t.end();
    });

    t.test('#stop', function(t) {
        t.test('resets camera.zooming', function(t) {
            var camera = createCamera();
            camera.zoomTo(3.2);
            camera.stop();
            t.ok(!camera.zooming);
            t.end();
        });

        t.test('resets camera.rotating', function(t) {
            var camera = createCamera();
            camera.rotateTo(90);
            camera.stop();
            t.ok(!camera.rotating);
            t.end();
        });

        t.test('emits moveend if panning, preserving eventData', function(t) {
            var camera = createCamera(),
                eventData = { data: 'ok' };

            camera.on('moveend', function(d) {
                t.equal(d.data, 'ok');
                t.end();
            });

            camera.panTo([100, 0], {}, eventData);
            camera.stop();
        });

        t.test('emits moveend if zooming, preserving eventData', function(t) {
            var camera = createCamera(),
                eventData = { data: 'ok' };

            camera.on('moveend', function(d) {
                t.equal(d.data, 'ok');
                t.end();
            });

            camera.zoomTo(3.2, {}, eventData);
            camera.stop();
        });

        t.test('emits moveend if rotating, preserving eventData', function(t) {
            var camera = createCamera(),
                eventData = { data: 'ok' };

            camera.on('moveend', function(d) {
                t.equal(d.data, 'ok');
                t.end();
            });

            camera.rotateTo(90, {}, eventData);
            camera.stop();
        });

        t.test('does not emit moveend if not moving', function(t) {
            var camera = createCamera(),
                eventData = { data: 'ok' };

            camera.on('moveend', function(d) {
                t.equal(d.data, 'ok');
                camera.stop();
                t.end(); // Fails with ".end() called twice" if we get here a second time.
            });

            camera.panTo([100, 0], {duration: 1}, eventData);
        });

        t.end();
    });

    t.end();
});
