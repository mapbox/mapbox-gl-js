import {describe, test, expect} from "../../util/vitest.js";
import {Aabb, Frustum, Ray} from '../../../src/util/primitives.js';
import {mat4, vec3} from 'gl-matrix';
import {fixedVec3} from '../../util/fixed.js';

describe('primitives', () => {
    describe('aabb', () => {
        test('Create an aabb', () => {
            const min = vec3.fromValues(0, 0, 0);
            const max = vec3.fromValues(2, 4, 6);
            const aabb = new Aabb(min, max);

            expect(aabb.min).toEqual(min);
            expect(aabb.max).toEqual(max);
            expect(aabb.center).toStrictEqual([1, 2, 3]);
        });

        test('Create an aabb from points', () => {
            const p0 = vec3.fromValues(-10, 20, 30);
            const p1 = vec3.fromValues(10, -30, 50);
            const p2 = vec3.fromValues(50, 10, -100);
            const p3 = vec3.fromValues(-15, 5, 120);
            const aabb = Aabb.fromPoints([p0, p1, p2, p3]);

            expect(aabb.min).toEqual([-15, -30, -100]);
            expect(aabb.max).toEqual([50, 20, 120]);
            expect(aabb.center).toEqual([17.5, -5, 10]);
        });

        test('Create 4 quadrants', () => {
            const min = vec3.fromValues(0, 0, 0);
            const max = vec3.fromValues(2, 4, 1);
            const aabb = new Aabb(min, max);

            expect(aabb.quadrant(0)).toEqual(new Aabb(vec3.fromValues(0, 0, 0), vec3.fromValues(1, 2, 1)));
            expect(aabb.quadrant(1)).toEqual(new Aabb(vec3.fromValues(1, 0, 0), vec3.fromValues(2, 2, 1)));
            expect(aabb.quadrant(2)).toEqual(new Aabb(vec3.fromValues(0, 2, 0), vec3.fromValues(1, 4, 1)));
            expect(aabb.quadrant(3)).toEqual(new Aabb(vec3.fromValues(1, 2, 0), vec3.fromValues(2, 4, 1)));
        });

        test('Distance to a point', () => {
            const min = vec3.fromValues(-1, -1, -1);
            const max = vec3.fromValues(1, 1, 1);
            const aabb = new Aabb(min, max);

            expect(aabb.distanceX([0.5, -0.5])).toEqual(0);
            expect(aabb.distanceY([0.5, -0.5])).toEqual(0);

            expect(aabb.distanceX([1, 1])).toEqual(0);
            expect(aabb.distanceY([1, 1])).toEqual(0);

            expect(aabb.distanceX([0, 10])).toEqual(0);
            expect(aabb.distanceY([0, 10])).toEqual(-9);

            expect(aabb.distanceX([-2, -2])).toEqual(1);
            expect(aabb.distanceY([-2, -2])).toEqual(1);
        });

        const createTestCameraFrustum = (fovy, aspectRatio, zNear, zFar, elevation, rotation) => {
            const proj = new Float64Array(16);
            const invProj = new Float64Array(16);
            // Note that left handed coordinate space is used where z goes towards the sky.
            // Y has to be flipped as well because it's part of the projection/camera matrix used in transform.js
            mat4.perspective(proj, fovy, aspectRatio, zNear, zFar);
            mat4.scale(proj, proj, [1, -1, 1]);
            mat4.translate(proj, proj, [0, 0, elevation]);
            mat4.rotateZ(proj, proj, rotation);
            mat4.invert(invProj, proj);

            return Frustum.fromInvProjectionMatrix(invProj, 1.0, 0.0);
        };

        test('Aabb fully inside a frustum', () => {
            const frustum = createTestCameraFrustum(Math.PI / 2, 1.0, 0.1, 100.0, -5, 0);

            // Intersection test is done in xy-plane
            const aabbList = [
                new Aabb(vec3.fromValues(-1, -1, 0), vec3.fromValues(1, 1, 0)),
                new Aabb(vec3.fromValues(-5, -5, 0), vec3.fromValues(5, 5, 0)),
                new Aabb(vec3.fromValues(-5, -5, 0), vec3.fromValues(-4, -2, 0))
            ];

            for (const aabb of aabbList)
                expect(aabb.intersects(frustum)).toEqual(2);
        });

        test('Aabb intersecting with a frustum', () => {
            const frustum = createTestCameraFrustum(Math.PI / 2, 1.0, 0.1, 100.0, -5, 0);

            const aabbList = [
                new Aabb(vec3.fromValues(-6, -6, 0), vec3.fromValues(6, 6, 0)),
                new Aabb(vec3.fromValues(-6, -6, 0), vec3.fromValues(-5, -5, 0))
            ];

            for (const aabb of aabbList)
                expect(aabb.intersects(frustum)).toEqual(1);
        });

        test('Aabb conservative intersection with a frustum', () => {
            const frustum = createTestCameraFrustum(Math.PI / 2, 1.0, 0.1, 100.0, -5, Math.PI / 4);
            const aabb = new Aabb(vec3.fromValues(-10, 10, 0), vec3.fromValues(10, 12, 0));

            // Intersection test should report intersection even though shapes are separate
            expect(aabb.intersects(frustum)).toEqual(1);
            expect(aabb.intersectsPrecise(frustum)).toEqual(0);
        });

        test('No intersection between aabb and frustum', () => {
            const frustum = createTestCameraFrustum(Math.PI / 2, 1.0, 0.1, 100.0, -5);

            const aabbList = [
                new Aabb(vec3.fromValues(-6, 0, 0), vec3.fromValues(-5.5, 0, 0)),
                new Aabb(vec3.fromValues(-6, -6, 0), vec3.fromValues(-5.5, -5.5, 0)),
                new Aabb(vec3.fromValues(7, -10, 0), vec3.fromValues(7.1, 20, 0))
            ];

            for (const aabb of aabbList)
                expect(aabb.intersects(frustum)).toEqual(0);
        });
    });

    describe('frustum', () => {
        test('Create a frustum from inverse projection matrix', () => {
            const proj = new Float64Array(16);
            const invProj = new Float64Array(16);
            mat4.perspective(proj, Math.PI / 2, 1.0, 0.1, 100.0);
            mat4.invert(invProj, proj);

            const frustum = Frustum.fromInvProjectionMatrix(invProj, 1.0, 0.0);

            // mat4.perspective generates a projection matrix for right handed coordinate space.
            // This means that forward direction will be -z
            const expectedFrustumPoints = [
                [-0.1, 0.1, -0.1],
                [0.1, 0.1, -0.1],
                [0.1, -0.1, -0.1],
                [-0.1, -0.1, -0.1],
                [-100.0, 100.0, -100.0],
                [100.0, 100.0, -100.0],
                [100.0, -100.0, -100.0],
                [-100.0, -100.0, -100.0],
            ];

            // Round numbers to mitigate the precision loss
            frustum.points = frustum.points.map(array => array.map(n => Math.round(n * 10) / 10));
            frustum.planes = frustum.planes.map(array => array.map(n => Math.round(n * 1000) / 1000));

            const expectedFrustumPlanes = [
                [0, 0, 1.0, 0.1],
                [-0, -0, -1.0, -100.0],
                [-0.707, 0, 0.707, -0],
                [0.707, 0, 0.707, -0],
                [0, -0.707, 0.707, -0],
                [-0, 0.707, 0.707, -0]
            ];

            expect(frustum.points).toEqual(expectedFrustumPoints);
            expect(frustum.planes).toEqual(expectedFrustumPlanes);
        });
    });

    describe('ray', () => {
        describe('intersectsPlane', () => {
            test('parallel', () => {
                const r = new Ray(vec3.fromValues(0, 0, 1), vec3.fromValues(1, 1, 0));
                expect(
                    r.intersectsPlane(vec3.fromValues(0, 0, 0), vec3.fromValues(0, 0, 1), vec3.create())
                ).toBeFalsy();
            });

            test('orthogonal', () => {
                const r = new Ray(vec3.fromValues(10, 20, 50), vec3.fromValues(0, 0, -1));
                const out = vec3.create();
                expect(r.intersectsPlane(vec3.fromValues(0, 0, 5), vec3.fromValues(0, 0, 1), out)).toBeTruthy();
                assertAlmostEqual(out[0], 10);
                assertAlmostEqual(out[1], 20);
                assertAlmostEqual(out[2], 5);
            });

            test('angled down', () => {
                const r = new Ray(vec3.fromValues(-10, -10, 20), vec3.fromValues(0.5773, 0.5773, -0.5773));
                const out = vec3.create();
                expect(
                    r.intersectsPlane(vec3.fromValues(0, 0, 10), vec3.fromValues(0, 0, 1), out)
                ).toBeTruthy();
                assertAlmostEqual(out[0], 0);
                assertAlmostEqual(out[1], 0);
                assertAlmostEqual(out[2], 10);
            });

            test('angled up', () => {
                const r = new Ray(vec3.fromValues(-10, -10, 20), vec3.fromValues(0.5773, 0.5773, 0.5773));
                const out = vec3.create();
                expect(
                    r.intersectsPlane(vec3.fromValues(0, 0, 10), vec3.fromValues(0, 0, 1), out)
                ).toBeTruthy();
                assertAlmostEqual(out[0], -20);
                assertAlmostEqual(out[1], -20);
                assertAlmostEqual(out[2], 10);
            });
        });

        describe('closestPointOnSphere', () => {
            test('intersection', () => {
                const r = new Ray(vec3.fromValues(0, 0, 5), vec3.fromValues(0, 0, -1));

                const point = vec3.fromValues(0, 0, 0);
                let intersection = r.closestPointOnSphere(vec3.fromValues(0, 0, 0), 1.0, point);
                expect(intersection).toBeTruthy();
                expect(vec3.fromValues(0, 0, 1)).toEqual(point);

                r.pos = vec3.fromValues(0.8, 0.0, 100000.0);
                intersection = r.closestPointOnSphere(vec3.fromValues(0, 0, 0), 1.0, point);
                expect(intersection).toBeTruthy();
                expect(vec3.fromValues(0.8, 0, 0.60000050)).toEqual(point);

                r.pos = vec3.fromValues(1, 1, 1);
                r.dir = vec3.normalize([], vec3.fromValues(-1, -1, -1));
                intersection = r.closestPointOnSphere(vec3.fromValues(0, 0, 0), 1.0, point);
                expect(intersection).toBeTruthy();
                expect(vec3.fromValues(0.57735026, 0.57735026, 0.57735026)).toEqual(point);
            });

            test('away', () => {
                const r = new Ray(vec3.fromValues(0, 0, 5), vec3.fromValues(0, 0, 1));

                const point = vec3.fromValues(0, 0, 0);
                const intersection = r.closestPointOnSphere(vec3.fromValues(0, 0, 0), 4.99, point);
                expect(intersection).toBeFalsy();
                expect(fixedVec3(vec3.fromValues(0, 0, 4.99), 2)).toEqual(fixedVec3(point, 2));
            });

            test('no intersection', () => {
                const r = new Ray(vec3.fromValues(0, 0, 5), vec3.fromValues(0, 0, -1));

                const point = vec3.fromValues(0, 0, 0);
                const intersection = r.closestPointOnSphere(vec3.fromValues(2, 0, 0), 1, point);
                expect(intersection).toBeFalsy();
                expect(vec3.fromValues(-1, 0, 0)).toEqual(point);
            });

            test('inside', () => {
                const r = new Ray(vec3.fromValues(0.5, 0.1, 0), vec3.fromValues(1, 0, 1));

                const point = vec3.fromValues(0, 0, 0);
                const intersection = r.closestPointOnSphere(vec3.fromValues(0, 0, 0), 1, point);
                expect(intersection).toBeFalsy();
                expect(fixedVec3(vec3.fromValues(0.98058, 0.19612, 0), 5)).toEqual(fixedVec3(point, 5));
            });

            test('zero radius', () => {
                const r = new Ray(vec3.fromValues(1.0, 0.0, 3.0), vec3.fromValues(0, 0, -1));

                const point = vec3.fromValues(0, 0, 0);
                let intersection = r.closestPointOnSphere(vec3.fromValues(0, 0, 0), 0, point);
                expect(intersection).toBeFalsy();
                expect(vec3.fromValues(0, 0, 0)).toEqual(point);

                intersection = r.closestPointOnSphere(vec3.fromValues(1.0, 0, 0), 0, point);
                expect(intersection).toBeFalsy();
                expect(vec3.fromValues(0, 0, 0)).toEqual(point);
            });

            test('point at sphere center', () => {
                const r = new Ray(vec3.fromValues(0.5, 2, 0), vec3.fromValues(1, 0, 0));

                const point = vec3.fromValues(0, 0, 0);
                const intersection = r.closestPointOnSphere(vec3.fromValues(0.5, 2.0, 0), 3.0, point);
                expect(intersection).toBeFalsy();
                expect(vec3.fromValues(0, 0, 0)).toEqual(point);
            });

            test('point at surface', () => {
                const r = new Ray(vec3.fromValues(1, 0, 0), vec3.fromValues(0, 0, 1));

                const point = vec3.fromValues(0, 0, 0);
                const intersection = r.closestPointOnSphere(vec3.fromValues(0, 0, 0), 1, point);
                expect(intersection).toBeTruthy();
                expect(vec3.fromValues(1, 0, 0)).toEqual(point);
            });
        });
    });
});

function assertAlmostEqual(actual, expected, epsilon = 1e-6) {
    expect(Math.abs(actual - expected) < epsilon).toBeTruthy();
}
