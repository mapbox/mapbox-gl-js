// @flow

import {vec3, vec4} from 'gl-matrix';
import assert from 'assert';
import {UnwrappedTileID} from '../source/tile_id.js';

import type {Vec3, Vec4, Mat4} from 'gl-matrix';
import {register} from './web_worker_transfer.js';

class Ray {
    pos: Vec3;
    dir: Vec3;

    constructor(pos_: Vec3, dir_: Vec3) {
        this.pos = pos_;
        this.dir = dir_;
    }

    intersectsPlane(pt: Vec3, normal: Vec3, out: Vec3): boolean {
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

    closestPointOnSphere(center: Vec3, r: number, out: Vec3): boolean {
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

class FrustumCorners {
    TL: [number, number, number];
    TR: [number, number, number];
    BR: [number, number, number];
    BL: [number, number, number];
    horizon: number;

    constructor(TL_: [number, number, number], TR_: [number, number, number], BR_: [number, number, number], BL_: [number, number, number], horizon_: number) {
        this.TL = TL_;
        this.TR = TR_;
        this.BR = BR_;
        this.BL = BL_;
        this.horizon = horizon_;
    }

    static fromInvProjectionMatrix(invProj: Array<number>, horizonFromTop: number, viewportHeight: number): FrustumCorners {
        const TLClip = [-1, 1, 1];
        const TRClip = [1, 1, 1];
        const BRClip = [1, -1, 1];
        const BLClip = [-1, -1, 1];

        const TL = vec3.transformMat4(TLClip, TLClip, invProj);
        const TR = vec3.transformMat4(TRClip, TRClip, invProj);
        const BR = vec3.transformMat4(BRClip, BRClip, invProj);
        const BL = vec3.transformMat4(BLClip, BLClip, invProj);

        return new FrustumCorners(TL, TR, BR, BL, horizonFromTop / viewportHeight);
    }
}

function projectPoints(points: Array<Vec3>, origin: Vec3, axis: Vec3): [number, number] {
    let min = Infinity;
    let max = -Infinity;

    const vec = [];
    for (const point of points) {
        vec3.sub(vec, point, origin);
        const projection = vec3.dot(vec, axis);

        min = Math.min(min, projection);
        max = Math.max(max, projection);
    }

    return [min, max];
}

function intersectsFrustum(frustum: Frustum, aabbPoints: Array<Vec3>): number {
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

    return fullyInside ? 2 : 1;
}

function intersectsFrustumPrecise(frustum: Frustum, aabbPoints: Array<Vec3>): number {
    for (const proj of frustum.projections) {
        const projectedAabb = projectPoints(aabbPoints, frustum.points[0], proj.axis);

        if (proj.projection[1] < projectedAabb[0] || proj.projection[0] > projectedAabb[1]) {
            return 0;
        }
    }

    return 1;
}

type Projection = {
    axis: Vec3;
    projection: [number, number];
};

type FrustumPoints = [Vec3, Vec3, Vec3, Vec3, Vec3, Vec3, Vec3, Vec3];
type FrustumPlanes = [Vec4, Vec4, Vec4, Vec4, Vec4, Vec4];

const NEAR_TL = 0;
const NEAR_TR = 1;
const NEAR_BR = 2;
const NEAR_BL = 3;
const FAR_TL = 4;
const FAR_TR = 5;
const FAR_BR = 6;
const FAR_BL = 7;

function pointsInsideOfPlane(points: Array<Vec3>, plane: Vec4): number {
    let pointsInside = 0;
    const p = [0, 0, 0, 0];
    for (let i = 0; i < points.length; i++) {
        p[0] = points[i][0];
        p[1] = points[i][1];
        p[2] = points[i][2];
        p[3] = 1.0;
        if (vec4.dot(p, plane) >= 0) {
            pointsInside++;
        }
    }
    return pointsInside;
}

class Frustum {
    points: FrustumPoints;
    planes: FrustumPlanes;
    bounds: Aabb;
    projections: Array<Projection>;
    frustumEdges: Array<Vec3>;

    constructor(points_: ?FrustumPoints, planes_: ?FrustumPlanes) {
        this.points = points_ || (new Array(8).fill([0, 0, 0]): any);
        this.planes = planes_ || (new Array(6).fill([0, 0, 0, 0]): any);
        this.bounds = Aabb.fromPoints((this.points: any));
        this.projections = [];

        // Precompute a set of separating axis candidates for precise intersection tests.
        // These axes are computed as follows: (edges of aabb) x (edges of frustum)
        this.frustumEdges = [
            vec3.sub([], this.points[NEAR_BR], this.points[NEAR_BL]),
            vec3.sub([], this.points[NEAR_TL], this.points[NEAR_BL]),
            vec3.sub([], this.points[FAR_TL], this.points[NEAR_TL]),
            vec3.sub([], this.points[FAR_TR], this.points[NEAR_TR]),
            vec3.sub([], this.points[FAR_BR], this.points[NEAR_BR]),
            vec3.sub([], this.points[FAR_BL], this.points[NEAR_BL])
        ];

        for (const edge of this.frustumEdges) {
            // Cross product [1, 0, 0] x [a, b, c] == [0, -c, b]
            // Cross product [0, 1, 0] x [a, b, c] == [c, 0, -a]
            const axis0 = [0, -edge[2], edge[1]];
            const axis1 = [edge[2], 0, -edge[0]];

            this.projections.push({
                axis: axis0,
                projection: projectPoints((this.points: any), this.points[0], axis0)
            });

            this.projections.push({
                axis: axis1,
                projection: projectPoints((this.points: any), this.points[0], axis1)
            });
        }
    }

    static fromInvProjectionMatrix(invProj: Float64Array, worldSize: number, zoom: number, zInMeters: boolean): Frustum {
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

        const scale = Math.pow(2, zoom);

        // Transform frustum corner points from clip space to tile space
        const frustumCoords = clipSpaceCorners
            .map(v => {
                const s = vec4.transformMat4([], v, invProj);
                const k = 1.0 / s[3] / worldSize * scale;
                // Z scale in meters.
                return vec4.mul(s, s, [k, k, zInMeters ? 1.0 / s[3] : k, k]);
            });

        const frustumPlanePointIndices = [
            [NEAR_TL, NEAR_TR, NEAR_BR], // near
            [FAR_BR, FAR_TR, FAR_TL],    // far
            [NEAR_TL, NEAR_BL, FAR_BL],  // left
            [NEAR_BR, NEAR_TR, FAR_TR],  // right
            [NEAR_BL, NEAR_BR, FAR_BR],  // bottom
            [NEAR_TL, FAR_TL, FAR_TR]    // top
        ];

        const frustumPlanes = frustumPlanePointIndices.map((p: Vec3) => {
            const a = vec3.sub([], frustumCoords[p[0]], frustumCoords[p[1]]);
            const b = vec3.sub([], frustumCoords[p[2]], frustumCoords[p[1]]);
            const n = vec3.normalize([], vec3.cross([], a, b));
            const d = -vec3.dot(n, frustumCoords[p[1]]);
            return n.concat(d);
        });
        const frustumPoints = [];
        for (let i = 0; i < frustumCoords.length; i++) {
            frustumPoints.push([frustumCoords[i][0], frustumCoords[i][1], frustumCoords[i][2]]);
        }
        return new Frustum((frustumPoints: any), (frustumPlanes: any));
    }

    // Performs precise intersection test between the frustum and the provided convex hull.
    // The hull consits of vertices, faces (defined as planes) and a list of edges.
    // Intersection test is performed using separating axis theoreom.
    intersectsPrecise(vertices: Array<Vec3>, faces: Array<Vec4>, edges: Array<Vec3>): number {
        // Check if any of the provided faces defines a separating axis
        for (let i = 0; i < faces.length; i++) {
            if (!pointsInsideOfPlane(vertices, faces[i])) {
                return 0;
            }
        }
        // Check if any of the frustum planes defines a separating axis
        for (let i = 0; i < this.planes.length; i++) {
            if (!pointsInsideOfPlane(vertices, this.planes[i])) {
                return 0;
            }
        }

        for (const edge of edges) {
            for (const frustumEdge of this.frustumEdges) {
                const axis = vec3.cross([], edge, frustumEdge);
                const len  = vec3.length(axis);
                if (len === 0) {
                    continue;
                }

                vec3.scale(axis, axis, 1 / len);
                const projA = projectPoints((this.points: any), this.points[0], axis);
                const projB = projectPoints((vertices: any), this.points[0], axis);

                if (projA[0] > projB[1] || projB[0] > projA[1]) {
                    return 0;
                }
            }
        }
        return 1;
    }

}

class Aabb {
    min: Vec3;
    max: Vec3;
    center: Vec3;

    static fromPoints(points: Array<Vec3>): Aabb {
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];

        for (const p of points) {
            vec3.min(min, min, p);
            vec3.max(max, max, p);
        }

        return new Aabb(min, max);
    }

    static fromTileIdAndHeight(id: UnwrappedTileID, minHeight: number, maxHeight: number): Aabb {
        const tiles = 1 << id.canonical.z;
        const x = id.canonical.x;
        const y = id.canonical.y;

        return new Aabb([x / tiles, y / tiles, minHeight], [(x + 1) / tiles, (y + 1) / tiles, maxHeight]);
    }

    static applyTransform(aabb: Aabb, transform: Mat4): Aabb {
        const corners = aabb.getCorners();

        for (let i = 0; i < corners.length; ++i) {
            vec3.transformMat4(corners[i], corners[i], transform);
        }
        return Aabb.fromPoints(corners);
    }

    static projectAabbCorners(aabb: Aabb, transform: Mat4): Array<Vec3> {
        const corners = aabb.getCorners();

        for (let i = 0; i < corners.length; ++i) {
            vec3.transformMat4(corners[i], corners[i], transform);
        }
        return corners;
    }

    constructor(min_: Vec3, max_: Vec3) {
        this.min = min_;
        this.max = max_;
        this.center = vec3.scale([], vec3.add([], this.min, this.max), 0.5);
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

    getCorners(): Array<Vec3> {
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

    // Performs conservative intersection test using separating axis theorem.
    // Some accuracy is traded for better performance. False positive rate is < 1%.
    // Flat intersection test checks only x and y dimensions of the aabb.
    // Returns 0 if there's no intersection, 1 if shapes are intersecting and
    // 2 if the aabb if fully inside the frustum.
    intersects(frustum: Frustum): number {
        // Execute separating axis test between two convex objects to find intersections
        // Each frustum plane together with 3 major axes define the separating axes
        // This implementation is conservative as it's not checking all possible axes.
        // False positive rate is ~0.5% of all cases (see intersectsPrecise).
        if (!this.intersectsAabb(frustum.bounds)) {
            return 0;
        }

        return intersectsFrustum(frustum, this.getCorners());
    }

    intersectsFlat(frustum: Frustum): number {
        if (!this.intersectsAabb(frustum.bounds)) {
            return 0;
        }

        // Perform intersection test against flattened (z === 0) aabb
        const aabbPoints = [
            [this.min[0], this.min[1], 0.0],
            [this.max[0], this.min[1], 0.0],
            [this.max[0], this.max[1], 0.0],
            [this.min[0], this.max[1], 0.0]
        ];

        return intersectsFrustum(frustum, aabbPoints);
    }

    // Performs precise intersection test using separating axis theorem.
    // It is possible run only edge cases that were not covered in intersects().
    // Flat intersection test checks only x and y dimensions of the aabb.
    intersectsPrecise(frustum: Frustum, edgeCasesOnly: ?boolean): number {
        if (!edgeCasesOnly) {
            const intersects = this.intersects(frustum);

            if (!intersects) {
                return 0;
            }
        }

        return intersectsFrustumPrecise(frustum, this.getCorners());
    }

    intersectsPreciseFlat(frustum: Frustum, edgeCasesOnly: ?boolean): number {
        if (!edgeCasesOnly) {
            const intersects = this.intersectsFlat(frustum);

            if (!intersects) {
                return 0;
            }
        }

        // Perform intersection test against flattened (z === 0) aabb
        const aabbPoints = [
            [this.min[0], this.min[1], 0.0],
            [this.max[0], this.min[1], 0.0],
            [this.max[0], this.max[1], 0.0],
            [this.min[0], this.max[1], 0.0]
        ];

        return intersectsFrustumPrecise(frustum, aabbPoints);
    }

    intersectsAabb(aabb: Aabb): boolean {
        for (let axis = 0; axis < 3; ++axis) {
            if (this.min[axis] > aabb.max[axis] || aabb.min[axis] > this.max[axis]) {
                return false;
            }
        }
        return true;
    }

    intersectsAabbXY(aabb: Aabb): boolean {
        if (this.min[0] > aabb.max[0] || aabb.min[0] > this.max[0]) {
            return false;
        }
        if (this.min[1] > aabb.max[1] || aabb.min[1] > this.max[1]) {
            return false;
        }
        return true;
    }

    encapsulate(aabb: Aabb) {
        for (let i = 0; i < 3; i++) {
            this.min[i] = Math.min(this.min[i], aabb.min[i]);
            this.max[i] = Math.max(this.max[i], aabb.max[i]);
        }
    }

    encapsulatePoint(point: Vec3) {
        for (let i = 0; i < 3; i++) {
            this.min[i] = Math.min(this.min[i], point[i]);
            this.max[i] = Math.max(this.max[i], point[i]);
        }
    }

    closestPoint(point: Vec3): Vec3 {
        return [Math.max(Math.min(this.max[0], point[0]), this.min[0]),
            Math.max(Math.min(this.max[1], point[1]), this.min[1]),
            Math.max(Math.min(this.max[2], point[2]), this.min[2])];
    }
}

register(Aabb, 'Aabb');

export {
    Aabb,
    Frustum,
    FrustumCorners,
    Ray
};
