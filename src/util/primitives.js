// @flow

import {vec3, vec4} from 'gl-matrix';
import assert from 'assert';

class Ray {
    pos: vec3;
    dir: vec3;

    constructor(pos_: vec3, dir_: vec3) {
        this.pos = pos_;
        this.dir = dir_;
    }

    intersectsPlane(pt: vec3, normal: vec3, out: vec3): boolean {
        const D = vec3.dot(normal, this.dir);

        // ray is parallel to plane, so it misses
        if (Math.abs(D) < 1e-6) { return false; }

        const t = (
            (pt[0] - this.pos[0]) * normal[0] +
            (pt[1] - this.pos[1]) * normal[1] +
            (pt[2] - this.pos[2]) * normal[2]) / D;

        out[0] = this.pos[0] + this.dir[0] * t;
        out[1] = this.pos[1] + this.dir[1] * t;
        out[2] = this.pos[2] + this.dir[2] * t;

        return true;
    }

    closestPointOnSphere(center: vec3, r: number, out: vec3): boolean {
        assert(vec3.squaredLength(this.dir) > 0.0 && r >= 0.0);

        if (vec3.equals(this.pos, center) || r === 0.0) {
            out[0] = out[1] = out[2] = 0;
            return false;
        }

        const [dx, dy, dz] = this.dir;

        const px = this.pos[0] - center[0];
        const py = this.pos[1] - center[1];
        const pz = this.pos[2] - center[2];

        const a = dx * dx + dy * dy + dz * dz;
        const b = 2.0 * (px * dx + py * dy + pz * dz);
        const c = (px * px + py * py + pz * pz) - r * r;
        const d = b * b - 4 * a * c;

        if (d < 0.0) {
            // No intersection, find distance between closest points
            const t = Math.max(-b / 2, 0.0);
            const gx = px + dx * t; // point to globe
            const gy = py + dy * t;
            const gz = pz + dz * t;
            const glen = Math.hypot(gx, gy, gz);
            out[0] = gx * r / glen;
            out[1] = gy * r / glen;
            out[2] = gz * r / glen;
            return false;

        } else {
            assert(a > 0.0);
            const t = (-b - Math.sqrt(d)) / (2.0 * a);

            if (t < 0.0) {
                // Ray is pointing away from the sphere
                const plen = Math.hypot(px, py, pz);
                out[0] = px * r / plen;
                out[1] = py * r / plen;
                out[2] = pz * r / plen;
                return false;

            } else {
                out[0] = px + dx * t;
                out[1] = py + dy * t;
                out[2] = pz + dz * t;
                return true;
            }
        }
    }
}

const clipSpaceCorners = [
    [-1, 1, -1, 1],
    [ 1, 1, -1, 1],
    [ 1, -1, -1, 1],
    [-1, -1, -1, 1],
    [-1, 1, 1, 1],
    [ 1, 1, 1, 1],
    [ 1, -1, 1, 1],
    [-1, -1, 1, 1]
];

const frustumPlanePointIndices = [
    [0, 1, 2],  // near
    [6, 5, 4],  // far
    [0, 3, 7],  // left
    [2, 1, 5],  // right
    [3, 2, 6],  // bottom
    [0, 4, 5]   // top
];

class Frustum {
    points: Array<Array<number>>;
    planes: Array<Array<number>>;

    constructor(points: Array<Array<number>>, planes: Array<Array<number>>) {
        this.points = points;
        this.planes = planes;
    }

    static fromInvProjectionMatrix(invProj: Float64Array, worldSize: number, zoom: number, zInMeters: boolean): Frustum {
        const scale = Math.pow(2, zoom) / worldSize;

        // Transform frustum corner points from clip space to tile space
        const frustumCoords = clipSpaceCorners.map(v => {
            const s = vec4.transformMat4([], v, invProj);
            vec4.scale(s, s, 1.0 / s[3] * scale);
            if (zInMeters) s[2] /= scale;
            return s;
        });

        const frustumPlanes = frustumPlanePointIndices.map((p: Array<number>) => {
            const p0 = frustumCoords[p[0]];
            const p1 = frustumCoords[p[1]];
            const p2 = frustumCoords[p[2]];
            const ax = p0[0] - p1[0];
            const ay = p0[1] - p1[1];
            const az = p0[2] - p1[2];
            const bx = p2[0] - p1[0];
            const by = p2[1] - p1[1];
            const bz = p2[2] - p1[2];
            const n = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx]; // cross product
            vec3.normalize(n, n);
            n[3] = -vec3.dot(n, p1);
            return n;
        });

        return new Frustum(frustumCoords, frustumPlanes);
    }
}

class Aabb {
    min: vec3;
    max: vec3;
    center: vec3;

    constructor(min: vec3, max: vec3) {
        this.min = min;
        this.max = max;
        this.center = vec3.add([], min, max);
        vec3.scale(this.center, this.center, 0.5);
    }

    quadrant(index: number): Aabb {
        const split = [(index % 2) === 0, index < 2];
        const qMin = vec3.clone(this.min);
        const qMax = vec3.clone(this.max);
        for (let axis = 0; axis < split.length; axis++) {
            qMin[axis] = split[axis] ? this.min[axis] : this.center[axis];
            qMax[axis] = split[axis] ? this.center[axis] : this.max[axis];
        }
        // Temporarily, elevation is constant, hence quadrant.max.z = this.max.z
        qMax[2] = this.max[2];
        return new Aabb(qMin, qMax);
    }

    distanceX(point: Array<number>): number {
        const pointOnAabb = Math.max(Math.min(this.max[0], point[0]), this.min[0]);
        return pointOnAabb - point[0];
    }

    distanceY(point: Array<number>): number {
        const pointOnAabb = Math.max(Math.min(this.max[1], point[1]), this.min[1]);
        return pointOnAabb - point[1];
    }

    distanceZ(point: Array<number>): number {
        const pointOnAabb = Math.max(Math.min(this.max[2], point[2]), this.min[2]);
        return pointOnAabb - point[2];
    }

    getCorners() {
        const mn = this.min;
        const mx = this.max;
        return [
            [mn[0], mn[1], mn[2]],
            [mx[0], mn[1], mn[2]],
            [mx[0], mx[1], mn[2]],
            [mn[0], mx[1], mn[2]],
            [mn[0], mn[1], mx[2]],
            [mx[0], mn[1], mx[2]],
            [mx[0], mx[1], mx[2]],
            [mn[0], mx[1], mx[2]],
        ];
    }

    // Performs a frustum-aabb intersection test. Returns 0 if there's no intersection,
    // 1 if shapes are intersecting and 2 if the aabb if fully inside the frustum.
    intersects(frustum: Frustum): number {
        // Execute separating axis test between two convex objects to find intersections
        // Each frustum plane together with 3 major axes define the separating axes

        const aabbPoints = this.getCorners();
        let fullyInside = true;

        for (let p = 0; p < frustum.planes.length; p++) {
            const plane = frustum.planes[p];
            let pointsInside = 0;

            for (let i = 0; i < aabbPoints.length; i++) {
                pointsInside += vec3.dot(plane, aabbPoints[i]) + plane[3] >= 0;
            }

            if (pointsInside === 0)
                return 0;

            if (pointsInside !== aabbPoints.length)
                fullyInside = false;
        }

        if (fullyInside)
            return 2;

        for (let axis = 0; axis < 3; axis++) {
            let projMin = Number.MAX_VALUE;
            let projMax = -Number.MAX_VALUE;

            for (let p = 0; p < frustum.points.length; p++) {
                const projectedPoint = frustum.points[p][axis] - this.min[axis];

                projMin = Math.min(projMin, projectedPoint);
                projMax = Math.max(projMax, projectedPoint);
            }

            if (projMax < 0 || projMin > this.max[axis] - this.min[axis])
                return 0;
        }

        return 1;
    }
}
export {
    Aabb,
    Frustum,
    Ray
};
