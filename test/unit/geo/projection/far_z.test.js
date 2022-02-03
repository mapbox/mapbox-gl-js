import {test} from '../../../util/test.js';
import {farthestPixelDistanceOnPlane, farthestPixelDistanceOnSphere} from '../../../../src/geo/projection/far_z.js';
import {getProjection} from '../../../../src/geo/projection/index.js';
import Transform from '../../../../src/geo/transform.js';

test('FarZ', (t) => {

    t.test('farthestPixelDistanceOnPlane', (t) => {
        const tr = new Transform();
        tr.resize(100, 100);

        const mercator = getProjection({name: 'mercator'});
        let pixelsPerMeter = mercator.pixelsPerMeter(tr.center.lat, tr.worldSize);

        t.same(farthestPixelDistanceOnPlane(tr, pixelsPerMeter), 150 * 1.01);

        tr.pitch = 45.0;
        pixelsPerMeter = mercator.pixelsPerMeter(tr.center.lat, tr.worldSize);
        t.same(farthestPixelDistanceOnPlane(tr, pixelsPerMeter).toFixed(2), 227.25);

        tr.pitch = 60.0;
        pixelsPerMeter = mercator.pixelsPerMeter(tr.center.lat, tr.worldSize);
        t.same(farthestPixelDistanceOnPlane(tr, pixelsPerMeter).toFixed(3), 358.453);

        tr.pitch = 0.0;
        tr.zoom = 8.0;
        pixelsPerMeter = mercator.pixelsPerMeter(tr.center.lat, tr.worldSize);
        t.same(farthestPixelDistanceOnPlane(tr, pixelsPerMeter).toFixed(3), 151.5);

        tr.zoom = 22.0;
        pixelsPerMeter = mercator.pixelsPerMeter(tr.center.lat, tr.worldSize);
        t.same(farthestPixelDistanceOnPlane(tr, pixelsPerMeter).toFixed(3), 151.5);

        t.end();
    });

    t.test('farthestPixelDistanceOnSphere', (t) => {
        const tr = new Transform();
        tr.resize(100, 100);

        const globe = getProjection({name: 'globe'});
        const pixelsPerMeter = globe.pixelsPerMeter(tr.center.lat, tr.worldSize);

        // whole globe is visible. Farthest point on the surface where normal is parallel to the ray
        t.same(farthestPixelDistanceOnSphere(tr, pixelsPerMeter).toFixed(7), 204.8304807);

        tr.center = {lng: 0.0, lat: 70.0};
        t.same(farthestPixelDistanceOnSphere(tr, pixelsPerMeter).toFixed(7), 204.8304807);

        tr.zoom = 4.0;
        tr.center = {lng: 0.0, lat: 0.0};
        tr.pitch = 45.0;
        t.same(farthestPixelDistanceOnSphere(tr, pixelsPerMeter).toFixed(7), 257.0070650);

        tr.zoom = 4.5;
        tr.pitch = 0.0;
        t.same(farthestPixelDistanceOnSphere(tr, pixelsPerMeter).toFixed(7), 160.3579244);

        tr.zoom = 5.0;
        t.same(farthestPixelDistanceOnSphere(tr, pixelsPerMeter).toFixed(7), 159.9235165);

        t.end();
    });

    t.end();
});
