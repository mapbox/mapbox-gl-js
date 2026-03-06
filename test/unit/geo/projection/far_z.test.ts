// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect} from '../../../util/vitest';
import {farthestPixelDistanceOnPlane, farthestPixelDistanceOnSphere} from '../../../../src/geo/projection/far_z';
import {getProjection} from '../../../../src/geo/projection/index';
import Transform from '../../../../src/geo/transform';

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

        tr.zoom = 17.0;
        pixelsPerMeter = mercator.pixelsPerMeter(tr.center.lat, tr.worldSize);
        expect(farthestPixelDistanceOnPlane(tr, pixelsPerMeter).toFixed(3)).toBe("151.500");

        // Expanded furthest distance to prevent flicker on far plane
        tr.zoom = 22.0;
        pixelsPerMeter = mercator.pixelsPerMeter(tr.center.lat, tr.worldSize);
        expect(farthestPixelDistanceOnPlane(tr, pixelsPerMeter).toFixed(3)).toBe("909.000");
    });

    test('farthestPixelDistanceOnPlane extends far plane in orthographic mode', () => {
        const tr = new Transform();
        tr.resize(256, 128);
        tr._orthographicProjectionAtLowPitch = true;

        const mercator = getProjection({name: 'mercator'});
        const pixelsPerMeter = mercator.pixelsPerMeter(tr.center.lat, tr.worldSize);

        // Without the -10m road elevation extension this would be 192 * 1.01
        const baseOrthoDistance = 192 * 1.01;
        const orthoDistance = farthestPixelDistanceOnPlane(tr, pixelsPerMeter);
        expect(orthoDistance).toBeGreaterThan(baseOrthoDistance);

        // Non-orthographic should not include the road elevation extension
        tr._orthographicProjectionAtLowPitch = false;
        expect(farthestPixelDistanceOnPlane(tr, pixelsPerMeter)).toBe(baseOrthoDistance);
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
