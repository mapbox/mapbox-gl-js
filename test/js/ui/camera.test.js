'use strict';

var test = require('prova');
var Camera = require('../../../js/ui/camera');
var Evented = require('../../../js/util/evented');
var Transform = require('../../../js/geo/transform');
var util = require('../../../js/util/util');
var fixed = require('../../testutil/fixed');
var fixedLatLng = fixed.LatLng;

test('camera', function(t) {
    function createCamera(options) {
        var camera = new Camera();

        var transform = camera.transform = new Transform(0, 20);
        transform.width = 512;
        transform.height = 512;

        util.extend(camera, Evented);

        if (options) {
            camera.jumpTo(options);
        }

        return camera;
    }

    t.test('#jumpTo', function(t) {
        var camera = createCamera();

        t.test('sets center', function(t) {
            camera.jumpTo({center: [1, 2]});
            t.deepEqual(camera.getCenter(), { lat: 1, lng: 2 });
            t.end();
        });

        t.test('keeps current center if not specified', function(t) {
            camera.jumpTo({});
            t.deepEqual(camera.getCenter(), { lat: 1, lng: 2 });
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
                center: [1, 2],
                zoom: 3,
                bearing: 180,
                pitch: 45
            });
            t.deepEqual(camera.getCenter(), { lat: 1, lng: 2 });
            t.deepEqual(camera.getZoom(), 3);
            t.deepEqual(camera.getBearing(), 180);
            t.deepEqual(camera.getPitch(), 45);
            t.end();
        });

        t.test('emits move events', function(t) {
            var started, ended;
            camera.on('movestart', function() { started = true; })
                .on('moveend', function() { ended = true; });
            camera.jumpTo({center: [1, 2]});
            t.ok(started);
            t.ok(ended);
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
        var camera = createCamera();

        t.test('sets center', function(t) {
            camera.setCenter([1, 2]);
            t.deepEqual(camera.getCenter(), { lat: 1, lng: 2 });
            t.end();
        });

        t.test('emits move events', function(t) {
            var started, ended;
            camera.on('movestart', function() { started = true; })
                .on('moveend', function() { ended = true; });
            camera.setCenter([1, 2]);
            t.ok(started);
            t.ok(ended);
            t.end();
        });

        t.test('cancels in-progress easing', function(t) {
            camera.panTo([3, 4]);
            t.ok(camera.isEasing());
            camera.setCenter([1, 2]);
            t.ok(!camera.isEasing());
            t.end();
        });
    });

    t.test('#setZoom', function(t) {
        var camera = createCamera();

        t.test('sets zoom', function(t) {
            camera.setZoom(3);
            t.deepEqual(camera.getZoom(), 3);
            t.end();
        });

        t.test('emits move events', function(t) {
            var started, ended;
            camera.on('movestart', function() { started = true; })
                .on('moveend', function() { ended = true; });
            camera.setZoom(3);
            t.ok(started);
            t.ok(ended);
            t.end();
        });

        t.test('cancels in-progress easing', function(t) {
            camera.panTo([3, 4]);
            t.ok(camera.isEasing());
            camera.setZoom(3);
            t.ok(!camera.isEasing());
            t.end();
        });
    });

    t.test('#setBearing', function(t) {
        var camera = createCamera();

        t.test('sets bearing', function(t) {
            camera.setBearing(4);
            t.deepEqual(camera.getBearing(), 4);
            t.end();
        });

        t.test('emits move events', function(t) {
            var started, ended;
            camera.on('movestart', function() { started = true; })
                .on('moveend', function() { ended = true; });
            camera.setBearing(4);
            t.ok(started);
            t.ok(ended);
            t.end();
        });

        t.test('cancels in-progress easing', function(t) {
            camera.panTo([3, 4]);
            t.ok(camera.isEasing());
            camera.setBearing(4);
            t.ok(!camera.isEasing());
            t.end();
        });
    });

    t.test('#panBy', function(t) {
        t.test('pans by specified amount', function(t) {
            var camera = createCamera();
            camera.panBy([100, 0], { duration: 0 });
            t.deepEqual(camera.getCenter(), { lat: 0, lng: 70.3125 });
            t.end();
        });

        t.test('pans relative to viewport on a rotated camera', function(t) {
            var camera = createCamera({bearing: 180});
            camera.panBy([100, 0], { duration: 0 });
            t.deepEqual(camera.getCenter(), { lat: 0, lng: -70.3125 });
            t.end();
        });

        t.test('emits move events', function(t) {
            var camera = createCamera();
            var started;
            var moved;

            camera.on('movestart', function() {
                started = true;
            });

            camera.on('move', function() {
                moved = true;
            });

            camera.on('moveend', function() {
                t.ok(started);
                t.ok(moved);
                t.end();
            });

            camera.panBy([100, 0], { duration: 0 });
        });

        t.test('supresses movestart if noMoveStart option is true', function(t) {
            var camera = createCamera();
            var started;

            camera.on('movestart', function() {
                started = true;
            });

            camera.on('moveend', function() {
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
            camera.panTo([0, 100], { duration: 0 });
            t.deepEqual(camera.getCenter(), { lat: 0, lng: 100 });
            t.end();
        });

        t.test('pans with specified offset', function(t) {
            var camera = createCamera();
            camera.panTo([0, 100], { offset: [100, 0], duration: 0 });
            t.deepEqual(camera.getCenter(), { lat: 0, lng: 29.6875 });
            t.end();
        });

        t.test('pans with specified offset relative to viewport on a rotated camera', function(t) {
            var camera = createCamera({bearing: 180});
            camera.panTo([0, 100], { offset: [100, 0], duration: 0 });
            t.deepEqual(camera.getCenter(), { lat: 0, lng: 170.3125 });
            t.end();
        });

        t.test('emits move events', function(t) {
            var camera = createCamera();
            var started;
            var moved;

            camera.on('movestart', function() {
                started = true;
            });

            camera.on('move', function() {
                moved = true;
            });

            camera.on('moveend', function() {
                t.ok(started);
                t.ok(moved);
                t.end();
            });

            camera.panTo([0, 100], { duration: 0 });
        });

        t.test('supresses movestart if noMoveStart option is true', function(t) {
            var camera = createCamera();
            var started;

            camera.on('movestart', function() {
                started = true;
            });

            camera.on('moveend', function() {
                t.ok(!started);
                t.end();
            });

            camera.panTo([0, 100], { duration: 0, noMoveStart: true });
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
            camera.zoomTo(3.2, { around: [0, 5], duration: 0 });
            t.equal(camera.getZoom(), 3.2);
            t.deepEqual(fixedLatLng(camera.getCenter()), fixedLatLng({ lat: 0, lng: 4.455905897939886 }));
            t.end();
        });

        t.test('zooms with specified offset', function(t) {
            var camera = createCamera();
            camera.zoomTo(3.2, { offset: [100, 0], duration: 0 });
            t.equal(camera.getZoom(), 3.2);
            t.deepEqual(fixedLatLng(camera.getCenter()), fixedLatLng({ lat: 0, lng: 62.66117668978015 }));
            t.end();
        });

        t.test('zooms with specified offset relative to viewport on a rotated camera', function(t) {
            var camera = createCamera({bearing: 180});
            camera.zoomTo(3.2, { offset: [100, 0], duration: 0 });
            t.equal(camera.getZoom(), 3.2);
            t.deepEqual(fixedLatLng(camera.getCenter()), fixedLatLng({ lat: 0, lng: -62.66117668978012 }));
            t.end();
        });

        t.test('emits move and zoom events', function(t) {
            var camera = createCamera();
            var started;
            var moved;
            var zoomed;

            camera.on('movestart', function() {
                started = true;
            });

            camera.on('move', function() {
                moved = true;
            });

            camera.on('zoom', function() {
                zoomed = true;
            });

            camera.on('moveend', function() {
                t.ok(started);
                t.ok(moved);
                t.ok(zoomed);
                t.end();
            });

            camera.zoomTo(3.2, { duration: 0 });
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
            camera.rotateTo(90, { around: [0, 5], duration: 0 });
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLatLng(camera.getCenter()), fixedLatLng({ lat: 4.993665859353271, lng: 4.999999999999972 }));
            t.end();
        });

        t.test('rotates around specified location, constrained to fit the view', function (t) {
            var camera = createCamera({ zoom: 0 });
            camera.rotateTo(90, { around: [0, 5], duration: 0 });
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLatLng(camera.getCenter()), fixedLatLng({ lat: 0.000014144426558004852, lng: 4.999999999999972 }));
            t.end();
        });

        t.test('rotates with specified offset', function(t) {
            var camera = createCamera({ zoom: 1 });
            camera.rotateTo(90, { offset: [200, 0], duration: 0 });
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLatLng(camera.getCenter()), fixedLatLng({ lat: 57.32652122521708, lng: 70.3125 }));
            t.end();
        });

        t.test('rotates with specified offset, constrained to fit the view', function(t) {
            var camera = createCamera({ zoom: 0 });
            camera.rotateTo(90, { offset: [100, 0], duration: 0 });
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLatLng(camera.getCenter()), fixedLatLng({ lat: 0.000014144426558004852, lng: 70.3125 }));
            t.end();
        });

        t.test('rotates with specified offset relative to viewport on a rotated camera', function(t) {
            var camera = createCamera({ bearing: 180, zoom: 1 });
            camera.rotateTo(90, { offset: [200, 0], duration: 0 });
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLatLng(camera.getCenter()), fixedLatLng({ lat: 57.32652122521708, lng: -70.3125 }));
            t.end();
        });

        t.test('emits move and rotate events', function(t) {
            var camera = createCamera();
            var started;
            var moved;
            var rotated;

            camera.on('movestart', function() {
                started = true;
            });

            camera.on('move', function() {
                moved = true;
            });

            camera.on('rotate', function() {
                rotated = true;
            });

            camera.on('moveend', function() {
                t.ok(started);
                t.ok(moved);
                t.ok(rotated);
                t.end();
            });

            camera.rotateTo(90, { duration: 0 });
        });

        t.end();
    });

    t.test('#easeTo', function(t) {
        t.test('pans to specified location', function(t) {
            var camera = createCamera();
            camera.easeTo({ center: [0, 100], duration: 0 });
            t.deepEqual(camera.getCenter(), { lat: 0, lng: 100 });
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

        t.test('pans and zooms', function(t) {
            var camera = createCamera();
            camera.easeTo({ center: [0, 100], zoom: 3.2, duration: 0 });
            t.deepEqual(fixedLatLng(camera.getCenter()), fixedLatLng({ lat: 0, lng: 100 }));
            t.equal(camera.getZoom(), 3.2);
            t.end();
        });

        t.test('pans and rotates', function(t) {
            var camera = createCamera();
            camera.easeTo({ center: [0, 100], bearing: 90, duration: 0 });
            t.deepEqual(camera.getCenter(), { lat: 0, lng: 100 });
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
            var camera = createCamera();
            camera.easeTo({ center: [0, 100], zoom: 3.2, bearing: 90, duration: 0 });
            t.deepEqual(fixedLatLng(camera.getCenter()), fixedLatLng({ lat: 0, lng: 100 }));
            t.equal(camera.getZoom(), 3.2);
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('noop', function(t) {
            var camera = createCamera();
            camera.easeTo({ duration: 0 });
            t.deepEqual(camera.getCenter(), { lat: 0, lng: 0 });
            t.equal(camera.getZoom(), 0);
            t.equal(camera.getBearing(), 0);
            t.end();
        });

        t.test('noop with offset', function(t) {
            var camera = createCamera();
            camera.easeTo({ offset: [100, 0], duration: 0 });
            t.deepEqual(camera.getCenter(), { lat: 0, lng: 0 });
            t.equal(camera.getZoom(), 0);
            t.equal(camera.getBearing(), 0);
            t.end();
        });

        t.test('pans with specified offset', function(t) {
            var camera = createCamera();
            camera.easeTo({ center: [0, 100], offset: [100, 0], duration: 0 });
            t.deepEqual(camera.getCenter(), { lat: 0, lng: 29.6875 });
            t.end();
        });

        t.test('pans with specified offset relative to viewport on a rotated camera', function(t) {
            var camera = createCamera({bearing: 180});
            camera.easeTo({ center: [0, 100], offset: [100, 0], duration: 0 });
            t.deepEqual(camera.getCenter(), { lat: 0, lng: 170.3125 });
            t.end();
        });

        t.test('emits move, zoom, and rotate events', function(t) {
            var camera = createCamera();
            var started;
            var moved;
            var zoomed;
            var rotated;

            camera.on('movestart', function() {
                started = true;
            });

            camera.on('move', function() {
                moved = true;
            });

            camera.on('zoom', function() {
                zoomed = true;
            });

            camera.on('rotate', function() {
                rotated = true;
            });

            camera.on('moveend', function() {
                t.ok(started);
                t.ok(moved);
                t.ok(zoomed);
                t.ok(rotated);
                t.end();
            });

            camera.easeTo({ center: [0, 100], zoom: 3.2, bearing: 90, duration: 0 });
        });

        t.test('stops existing ease', function(t) {
            var camera = createCamera();
            camera.easeTo({ center: [0, 200], duration: 100 });
            camera.easeTo({ center: [0, 100], duration: 0 });
            t.deepEqual(camera.getCenter(), { lat: 0, lng: 100 });
            t.end();
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
            camera.panTo([0, 100], {duration: 1});
            t.ok(camera.isEasing());
        });

        t.test('returns false when done panning', function(t) {
            var camera = createCamera();
            camera.on('moveend', function() {
                t.ok(!camera.isEasing());
                t.end();
            });
            camera.panTo([0, 100], {duration: 1});
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

        t.test('emits moveend if panning', function(t) {
            var camera = createCamera();

            camera.on('moveend', function() {
                t.end();
            });

            camera.panTo([0, 100]);
            camera.stop();
        });

        t.test('emits moveend if zooming', function(t) {
            var camera = createCamera();

            camera.on('moveend', function() {
                t.end();
            });

            camera.zoomTo(3.2);
            camera.stop();
        });

        t.test('emits moveend if rotating', function(t) {
            var camera = createCamera();

            camera.on('moveend', function() {
                t.end();
            });

            camera.rotateTo(90);
            camera.stop();
        });

        t.test('does not emit moveend if not moving', function(t) {
            var camera = createCamera();

            camera.on('moveend', function() {
                camera.stop();
                t.end(); // Fails with ".end() called twice" if we get here a second time.
            });

            camera.panTo([0, 100], {duration: 1});
        });

        t.end();
    });

    t.end();
});
