import {describe, test, expect} from "../../../util/vitest.js";
import {farthestPixelDistanceOnPlane, farthestPixelDistanceOnSphere} from '../../../../src/geo/projection/far_z.js';
import {getProjection} from '../../../../src/geo/projection/index.js';
import Transform from '../../../../src/geo/transform.js';

describe('FarZ', () => {
    test('farthestPixelDistanceOnPlane', () => {
        const tr = new Transform();
        tr.resize(100, 100);

        const mercator = getProjection({name: 'mercator'});
        let pixelsPerMeter = mercator.pixelsPerMeter(tr.center.lat, tr.worldSize);

        expect(farthestPixelDistanceOnPlane(tr, pixelsPerMeter)).toBe(150 * 1.01);

        tr.pitch = 45.0;
        pixelsPerMeter = mercator.pixelsPerMeter(tr.center.lat, tr.worldSize);
        expect(farthestPixelDistanceOnPlane(tr, pixelsPerMeter).toFixed(2)).toBe("227.25");

        tr.pitch = 60.0;
        pixelsPerMeter = mercator.pixelsPerMeter(tr.center.lat, tr.worldSize);
        expect(farthestPixelDistanceOnPlane(tr, pixelsPerMeter).toFixed(3)).toBe("358.453");

        tr.pitch = 0.0;
        tr.zoom = 8.0;
        pixelsPerMeter = mercator.pixelsPerMeter(tr.center.lat, tr.worldSize);
        expect(farthestPixelDistanceOnPlane(tr, pixelsPerMeter).toFixed(3)).toBe("151.500");

        tr.zoom = 22.0;
        pixelsPerMeter = mercator.pixelsPerMeter(tr.center.lat, tr.worldSize);
        expect(farthestPixelDistanceOnPlane(tr, pixelsPerMeter).toFixed(3)).toBe("151.500");
    });

    test('farthestPixelDistanceOnSphere', () => {
        const tr = new Transform();
        tr.resize(100, 100);

        const globe = getProjection({name: 'globe'});
        const pixelsPerMeter = globe.pixelsPerMeter(tr.center.lat, tr.worldSize);

        // whole globe is visible. Farthest point on the surface where normal is parallel to the ray
        expect(farthestPixelDistanceOnSphere(tr, pixelsPerMeter).toFixed(7)).toBe("204.8304807");

        tr.center = {lng: 0.0, lat: 70.0};
        expect(farthestPixelDistanceOnSphere(tr, pixelsPerMeter).toFixed(7)).toBe("204.8304807");

        tr.zoom = 4.0;
        tr.center = {lng: 0.0, lat: 0.0};
        tr.pitch = 45.0;
        expect(farthestPixelDistanceOnSphere(tr, pixelsPerMeter).toFixed(7)).toBe("257.0070650");

        tr.zoom = 4.5;
        tr.pitch = 0.0;
        expect(farthestPixelDistanceOnSphere(tr, pixelsPerMeter).toFixed(7)).toBe("160.3579244");

        tr.zoom = 5.0;
        expect(farthestPixelDistanceOnSphere(tr, pixelsPerMeter).toFixed(7)).toBe("159.9235165");
    });
});
