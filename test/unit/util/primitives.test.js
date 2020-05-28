import {test} from '../../util/test';
import {Aabb, Frustum} from '../../../src/util/primitives';
import {mat4, vec3} from 'gl-matrix';

test('primitives', (t) => {
    t.test('aabb', (t) => {
        t.test('Create an aabb', (t) => {
            const min = vec3.fromValues(0, 0, 0);
            const max = vec3.fromValues(2, 4, 6);
            const aabb = new Aabb(min, max);

            t.equal(aabb.min, min);
            t.equal(aabb.max, max);
            t.deepEqual(aabb.center, vec3.fromValues(1, 2, 3));
            t.end();
        });

        t.test('Create 4 quadrants', (t) => {
            const min = vec3.fromValues(0, 0, 0);
            const max = vec3.fromValues(2, 4, 1);
            const aabb = new Aabb(min, max);

            t.deepEqual(aabb.quadrant(0), new Aabb(vec3.fromValues(0, 0, 0), vec3.fromValues(1, 2, 1)));
            t.deepEqual(aabb.quadrant(1), new Aabb(vec3.fromValues(1, 0, 0), vec3.fromValues(2, 2, 1)));
            t.deepEqual(aabb.quadrant(2), new Aabb(vec3.fromValues(0, 2, 0), vec3.fromValues(1, 4, 1)));
            t.deepEqual(aabb.quadrant(3), new Aabb(vec3.fromValues(1, 2, 0), vec3.fromValues(2, 4, 1)));

            t.end();
        });

        t.test('Distance to a point', (t) => {
            const min = vec3.fromValues(-1, -1, -1);
            const max = vec3.fromValues(1, 1, 1);
            const aabb = new Aabb(min, max);

            t.equal(aabb.distanceX([0.5, -0.5]), 0);
            t.equal(aabb.distanceY([0.5, -0.5]), 0);

            t.equal(aabb.distanceX([1, 1]), 0);
            t.equal(aabb.distanceY([1, 1]), 0);

            t.equal(aabb.distanceX([0, 10]), 0);
            t.equal(aabb.distanceY([0, 10]), -9);

            t.equal(aabb.distanceX([-2, -2]), 1);
            t.equal(aabb.distanceY([-2, -2]), 1);
            t.end();
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

        t.test('Aabb fully inside a frustum', (t) => {
            const frustum = createTestCameraFrustum(Math.PI / 2, 1.0, 0.1, 100.0, -5, 0);

            // Intersection test is done in xy-plane
            const aabbList = [
                new Aabb(vec3.fromValues(-1, -1, 0), vec3.fromValues(1, 1, 0)),
                new Aabb(vec3.fromValues(-5, -5, 0), vec3.fromValues(5, 5, 0)),
                new Aabb(vec3.fromValues(-5, -5, 0), vec3.fromValues(-4, -2, 0))
            ];

            for (const aabb of aabbList)
                t.equal(aabb.intersects(frustum), 2);

            t.end();
        });

        t.test('Aabb intersecting with a frustum', (t) => {
            const frustum = createTestCameraFrustum(Math.PI / 2, 1.0, 0.1, 100.0, -5, 0);

            const aabbList = [
                new Aabb(vec3.fromValues(-6, -6, 0), vec3.fromValues(6, 6, 0)),
                new Aabb(vec3.fromValues(-6, -6, 0), vec3.fromValues(-5, -5, 0))
            ];

            for (const aabb of aabbList)
                t.equal(aabb.intersects(frustum), 1);

            t.end();
        });

        t.test('No intersection between aabb and frustum', (t) => {
            const frustum = createTestCameraFrustum(Math.PI / 2, 1.0, 0.1, 100.0, -5);

            const aabbList = [
                new Aabb(vec3.fromValues(-6, 0, 0), vec3.fromValues(-5.5, 0, 0)),
                new Aabb(vec3.fromValues(-6, -6, 0), vec3.fromValues(-5.5, -5.5, 0)),
                new Aabb(vec3.fromValues(7, -10, 0), vec3.fromValues(7.1, 20, 0))
            ];

            for (const aabb of aabbList)
                t.equal(aabb.intersects(frustum), 0);

            t.end();
        });

        t.end();
    });

    t.test('frustum', (t) => {
        t.test('Create a frustum from inverse projection matrix', (t) => {
            const proj = new Float64Array(16);
            const invProj = new Float64Array(16);
            mat4.perspective(proj, Math.PI / 2, 1.0, 0.1, 100.0);
            mat4.invert(invProj, proj);

            const frustum = Frustum.fromInvProjectionMatrix(invProj, 1.0, 0.0);

            // mat4.perspective generates a projection matrix for right handed coordinate space.
            // This means that forward direction will be -z
            const expectedFrustumPoints = [
                [-0.1, 0.1, -0.1, 1.0],
                [0.1, 0.1, -0.1, 1.0],
                [0.1, -0.1, -0.1, 1.0],
                [-0.1, -0.1, -0.1, 1.0],
                [-100.0, 100.0, -100.0, 1.0],
                [100.0, 100.0, -100.0, 1.0],
                [100.0, -100.0, -100.0, 1.0],
                [-100.0, -100.0, -100.0, 1.0],
            ];

            // Round numbers to mitigate the precision loss
            frustum.points = frustum.points.map(array => array.map(n => Math.round(n * 10) / 10));
            frustum.planes = frustum.planes.map(array => array.map(n => Math.round(n * 1000) / 1000));

            const expectedFrustumPlanes = [
                [0, 0, 1.0, 0.1],
                [0, 0, -1.0, -100.0],
                [-0.707, 0, 0.707, 0],
                [0.707, 0, 0.707, 0],
                [0, -0.707, 0.707, 0],
                [0, 0.707, 0.707, 0]
            ];

            t.deepEqual(frustum.points, expectedFrustumPoints);
            t.deepEqual(frustum.planes, expectedFrustumPlanes);
            t.end();
        });
        t.end();
    });
    t.end();
});
