// @flow
import MercatorCoordinate, {
    lngFromMercatorX,
    latFromMercatorY,
    mercatorZfromAltitude,
    mercatorXfromLng,
    mercatorYfromLat,
    MAX_MERCATOR_LATITUDE
} from '../mercator_coordinate.js';
import EXTENT from '../../data/extent.js';
import {number as interpolate} from '../../style-spec/util/interpolate.js';
import {degToRad, radToDeg, clamp, smoothstep, getColumn, shortestAngle} from '../../util/util.js';
import {vec3, vec4, mat3, mat4} from 'gl-matrix';
import SegmentVector from '../../data/segment.js';
import {members as globeLayoutAttributes} from '../../terrain/globe_attributes.js';
import posAttributes from '../../data/pos_attributes.js';
import {TriangleIndexArray, GlobeVertexArray, LineIndexArray, PosArray} from '../../data/array_types.js';
import {Aabb, Ray} from '../../util/primitives.js';
import LngLat from '../lng_lat.js';
import LngLatBounds from '../lng_lat_bounds.js';

import type Painter from '../../render/painter.js';
import type {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id.js';
import type Context from '../../gl/context.js';
import type {Vec3, Mat4} from 'gl-matrix';
import type IndexBuffer from '../../gl/index_buffer.js';
import type VertexBuffer from '../../gl/vertex_buffer.js';
import type Transform from '../transform.js';
import Point from '@mapbox/point-geometry';
import assert from 'assert';

export const GLOBE_ZOOM_THRESHOLD_MIN = 5;
export const GLOBE_ZOOM_THRESHOLD_MAX = 6;

// At low zoom levels the globe gets rendered so that the scale at this
// latitude matches it's scale in a mercator map. The choice of latitude is
// a bit arbitrary. Different choices will match mercator more closely in different
// views. 45 is a good enough choice because:
// - it's half way from the pole to the equator
// - matches most middle latitudes reasonably well
// - biases towards increasing size rather than decreasing
// - makes the globe slightly larger at very low zoom levels, where it already
//   covers less pixels than mercator (due to the curved surface)
//
//   Changing this value will change how large a globe is rendered and could affect
//   end users. This should only be done of the tradeoffs between change and improvement
//   are carefully considered.
export const GLOBE_SCALE_MATCH_LATITUDE = 45;

export const GLOBE_RADIUS = EXTENT / Math.PI / 2.0;
export const GLOBE_METERS_TO_ECEF = mercatorZfromAltitude(1, 0.0) * 2.0 * GLOBE_RADIUS * Math.PI;
const GLOBE_NORMALIZATION_BIT_RANGE = 15;
const GLOBE_NORMALIZATION_MASK = (1 << (GLOBE_NORMALIZATION_BIT_RANGE - 1)) - 1;
const GLOBE_VERTEX_GRID_SIZE = 64;
const GLOBE_LATITUDINAL_GRID_LOD_TABLE = [GLOBE_VERTEX_GRID_SIZE, GLOBE_VERTEX_GRID_SIZE / 2, GLOBE_VERTEX_GRID_SIZE / 4];
const TILE_SIZE = 512;

const GLOBE_MIN = -GLOBE_RADIUS;
const GLOBE_MAX = GLOBE_RADIUS;

const GLOBE_LOW_ZOOM_TILE_AABBS = [
    // z == 0
    new Aabb([GLOBE_MIN, GLOBE_MIN, GLOBE_MIN], [GLOBE_MAX, GLOBE_MAX, GLOBE_MAX]),
    // z == 1
    new Aabb([GLOBE_MIN, GLOBE_MIN, GLOBE_MIN], [0, 0, GLOBE_MAX]), // x=0, y=0
    new Aabb([0, GLOBE_MIN, GLOBE_MIN], [GLOBE_MAX, 0, GLOBE_MAX]), // x=1, y=0
    new Aabb([GLOBE_MIN, 0, GLOBE_MIN], [0, GLOBE_MAX, GLOBE_MAX]), // x=0, y=1
    new Aabb([0, 0, GLOBE_MIN], [GLOBE_MAX, GLOBE_MAX, GLOBE_MAX])  // x=1, y=1
];

export function globePointCoordinate(tr: Transform, x: number, y: number, clampToHorizon: boolean = true): ?MercatorCoordinate {
    const point0 = vec3.scale([], tr._camera.position, tr.worldSize);
    const point1 = [x, y, 1, 1];

    vec4.transformMat4(point1, point1, tr.pixelMatrixInverse);
    vec4.scale(point1, point1, 1 / point1[3]);

    const p0p1 = vec3.sub([], point1, point0);
    const dir = vec3.normalize([], p0p1);

    // Find closest point on the sphere to the ray. This is a bit more involving operation
    // if the ray is not intersecting with the sphere, in which case we "clamp" the ray
    // to the surface of the sphere, i.e. find a tangent vector that originates from the camera position
    const m = tr.globeMatrix;
    const globeCenter = [m[12], m[13], m[14]];
    const p0toCenter = vec3.sub([], globeCenter, point0);
    const p0toCenterDist = vec3.length(p0toCenter);
    const centerDir = vec3.normalize([], p0toCenter);
    const radius = tr.worldSize / (2.0 * Math.PI);
    const cosAngle = vec3.dot(centerDir, dir);

    const origoTangentAngle = Math.asin(radius / p0toCenterDist);
    const origoDirAngle = Math.acos(cosAngle);

    if (origoTangentAngle < origoDirAngle) {
        if (!clampToHorizon) return null;

        // Find the tangent vector by interpolating between camera-to-globe and camera-to-click vectors.
        // First we'll find a point P1 on the clicked ray that forms a right-angled triangle with the camera position
        // and the center of the globe. Angle of the tanget vector is then used as the interpolation factor
        const clampedP1 = [], origoToP1 = [];

        vec3.scale(clampedP1, dir, p0toCenterDist / cosAngle);
        vec3.normalize(origoToP1, vec3.sub(origoToP1, clampedP1, p0toCenter));
        vec3.normalize(dir, vec3.add(dir, p0toCenter, vec3.scale(dir, origoToP1, Math.tan(origoTangentAngle) * p0toCenterDist)));
    }

    const pointOnGlobe = [];
    const ray = new Ray(point0, dir);

    ray.closestPointOnSphere(globeCenter, radius, pointOnGlobe);

    // Transform coordinate axes to find lat & lng of the position
    const xa = vec3.normalize([], getColumn(m, 0));
    const ya = vec3.normalize([], getColumn(m, 1));
    const za = vec3.normalize([], getColumn(m, 2));

    const xp = vec3.dot(xa, pointOnGlobe);
    const yp = vec3.dot(ya, pointOnGlobe);
    const zp = vec3.dot(za, pointOnGlobe);

    const lat = radToDeg(Math.asin(-yp / radius));
    let lng = radToDeg(Math.atan2(xp, zp));

    // Check that the returned longitude angle is not wrapped
    lng = tr.center.lng + shortestAngle(tr.center.lng, lng);

    const mx = mercatorXfromLng(lng);
    const my = clamp(mercatorYfromLat(lat), 0, 1);

    return new MercatorCoordinate(mx, my);
}

export class Arc {
    constructor(p0: Vec3, p1: Vec3, center: Vec3) {
        this.a = vec3.sub([], p0, center);
        this.b = vec3.sub([], p1, center);
        this.center = center;
        const an = vec3.normalize([], this.a);
        const bn = vec3.normalize([], this.b);
        this.angle = Math.acos(vec3.dot(an, bn));
    }

    a: Vec3;
    b: Vec3;
    center: Vec3;
    angle: number;
}

export function slerp(a: number, b: number, angle: number, t: number): number {
    const sina = Math.sin(angle);
    return a * (Math.sin((1.0 - t) * angle) / sina) + b * (Math.sin(t * angle) / sina);
}

// Computes local extremum point of an arc on one of the dimensions (x, y or z),
// i.e. value of a point where d/dt*f(x,y,t) == 0
export function localExtremum(arc: Arc, dim: number): ?number {
    // d/dt*slerp(x,y,t) = 0
    // => t = (1/a)*atan(y/(x*sin(a))-1/tan(a)), x > 0
    // => t = (1/a)*(pi/2), x == 0
    if (arc.angle === 0) {
        return null;
    }

    let t: number;
    if (arc.a[dim] === 0) {
        t = (1.0 / arc.angle) * 0.5 * Math.PI;
    } else {
        t = 1.0 / arc.angle * Math.atan(arc.b[dim] / arc.a[dim] / Math.sin(arc.angle) - 1.0 / Math.tan(arc.angle));
    }

    if (t < 0 || t > 1) {
        return null;
    }

    return slerp(arc.a[dim], arc.b[dim], arc.angle, clamp(t, 0.0, 1.0)) + arc.center[dim];
}

export function globeTileBounds(id: CanonicalTileID): Aabb {
    if (id.z <= 1) {
        return GLOBE_LOW_ZOOM_TILE_AABBS[id.z + id.y * 2 + id.x];
    }

    // After zoom 1 surface function is monotonic for all tile patches
    // => it is enough to project corner points
    const bounds = tileCornersToBounds(id);
    const corners = boundsToECEF(bounds);

    return Aabb.fromPoints(corners);
}

export function interpolateVec3(from: Vec3, to: Vec3, phase: number): Vec3 {
    vec3.scale(from, from, 1 - phase);
    return vec3.scaleAndAdd(from, from, to, phase);
}

// Similar to globeTileBounds() but accounts for globe to Mercator transition.
export function transitionTileAABBinECEF(id: CanonicalTileID, tr: Transform): Aabb {
    const phase = globeToMercatorTransition(tr.zoom);
    if (phase === 0) {
        return globeTileBounds(id);
    }

    const bounds = tileCornersToBounds(id);
    const corners = boundsToECEF(bounds);

    const w = mercatorXfromLng(bounds.getWest()) * tr.worldSize;
    const e = mercatorXfromLng(bounds.getEast()) * tr.worldSize;
    const n = mercatorYfromLat(bounds.getNorth()) * tr.worldSize;
    const s = mercatorYfromLat(bounds.getSouth()) * tr.worldSize;
    // Mercator bounds globeCorners in world/pixel space
    const nw = [w, n, 0];
    const ne = [e, n, 0];
    const sw = [w, s, 0];
    const se = [e, s, 0];
    // Transform Mercator globeCorners to ECEF
    const worldToECEFMatrix = mat4.invert([], tr.globeMatrix);
    vec3.transformMat4(nw, nw, worldToECEFMatrix);
    vec3.transformMat4(ne, ne, worldToECEFMatrix);
    vec3.transformMat4(sw, sw, worldToECEFMatrix);
    vec3.transformMat4(se, se, worldToECEFMatrix);
    // Interpolate Mercator corners and globe corners
    corners[0] = interpolateVec3(corners[0], sw, phase);
    corners[1] = interpolateVec3(corners[1], se, phase);
    corners[2] = interpolateVec3(corners[2], ne, phase);
    corners[3] = interpolateVec3(corners[3], nw, phase);

    return Aabb.fromPoints(corners);
}

function transformPoints(corners: Array<Vec3>, globeMatrix: Mat4, scale: number) {
    for (const corner of corners) {
        vec3.transformMat4(corner, corner, globeMatrix);
        vec3.scale(corner, corner, scale);
    }
}

// Returns AABB in world/camera space scaled by numTiles / tr.worldSize
export function aabbForTileOnGlobe(tr: Transform, numTiles: number, tileId: CanonicalTileID): Aabb {
    const scale = numTiles / tr.worldSize;
    const m = tr.globeMatrix;

    if (tileId.z <= 1) {
        // Compute world/pixel space AABB that fully encapsulates
        // transformed corners of the ECEF AABB
        const corners = globeTileBounds(tileId).getCorners();
        transformPoints(corners, m, scale);
        return Aabb.fromPoints(corners);
    }

    // Find minimal aabb for a tile. Correct solution would be to compute bounding box that
    // fully encapsulates the curved patch that represents the tile on globes surface.
    // This can be simplified a bit as the globe transformation is constrained:
    //  1. Camera always faces the center point on the map
    //  2. Camera is always above (z-coordinate) all of the tiles
    //  3. Up direction of the coordinate space (pixel space) is always +z. This means that
    //     the "highest" point of the map is at the center.
    //  4. z-coordinate of any point in any tile descends as a function of the distance from the center

    // Simplified aabb is computed by first encapsulating 4 transformed corner points of the tile.
    // The resulting aabb is not complete yet as curved edges of the tile might span outside of the boundaries.
    // It is enough to extend the aabb to contain only the edge that's closest to the center point.
    const bounds = tileCornersToBounds(tileId);
    const corners = boundsToECEF(bounds);

    // Transform the corners to world space
    transformPoints(corners, m, scale);

    const mx = Number.MAX_VALUE;
    const cornerMax = [-mx, -mx, -mx];
    const cornerMin = [mx, mx, mx];

    // Extend the aabb by including the center point. There are some corner cases where center point is inside the
    // tile but due to curvature aabb computed from corner points does not cover the curved area.
    if (bounds.contains(tr.center)) {

        for (const corner of corners) {
            vec3.min(cornerMin, cornerMin, corner);
            vec3.max(cornerMax, cornerMax, corner);
        }
        cornerMax[2] = 0.0;
        const point = tr.point;
        const center = [point.x * scale, point.y * scale, 0];
        vec3.min(cornerMin, cornerMin, center);
        vec3.max(cornerMax, cornerMax, center);

        return new Aabb(cornerMin, cornerMax);
    }

    // Compute arcs describing edges of the tile on the globe surface.
    // Vertical edges revolves around the globe origin whereas horizontal edges revolves around the y-axis.
    const arcCenter = [m[12] * scale, m[13] * scale, m[14] * scale];

    const tileCenter = bounds.getCenter();
    const centerLat = clamp(tr.center.lat, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
    const tileCenterLat = clamp(tileCenter.lat, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
    const camX = mercatorXfromLng(tr.center.lng);
    const camY = mercatorYfromLat(centerLat);

    let dx = camX - mercatorXfromLng(tileCenter.lng);
    const dy = camY - mercatorYfromLat(tileCenterLat);

    // Shortest distance might be across the antimeridian
    if (dx > .5) {
        dx -= 1;
    } else if (dx < -.5) {
        dx += 1;
    }

    // Here we determine the arc which is closest to the map center point.
    // Horizontal arcs origin = globe center
    // Vertical arcs origin = globe center + yAxis * shift.
    // Where `shift` is determined by latitude.
    let closestArcIdx = 0;
    if (Math.abs(dx) > Math.abs(dy)) {
        closestArcIdx = dx >= 0 ? 1 : 3;
    } else {
        closestArcIdx = dy >= 0 ? 0 : 2;
        const yAxis = [m[4] * scale, m[5] * scale, m[6] * scale];
        const shift = -Math.sin(degToRad(dy >= 0 ? bounds.getSouth() : bounds.getNorth())) * GLOBE_RADIUS;
        vec3.scaleAndAdd(arcCenter, arcCenter, yAxis, shift);
    }

    const arcStart = corners[closestArcIdx];
    const arcEnd = corners[(closestArcIdx + 1) % 4];

    const closestArc = new Arc(arcStart, arcEnd, arcCenter);
    const arcExtremum = [
        (localExtremum(closestArc, 0) || arcStart[0]),
        (localExtremum(closestArc, 1) || arcStart[1]),
        (localExtremum(closestArc, 2) || arcStart[2])];

    const phase = globeToMercatorTransition(tr.zoom);
    if (phase > 0.0) {
        const mercatorCorners = mercatorTileCornersInCameraSpace(tileId, numTiles, tr._pixelsPerMercatorPixel, camX, camY);
        // Interpolate the four corners towards their world space location in mercator projection during transition.
        for (let i = 0; i < corners.length; i++) {
            interpolateVec3(corners[i], mercatorCorners[i], phase);
        }
        // Calculate the midpoint of the closest edge midpoint in Mercator
        const mercatorMidpoint = vec3.add([], mercatorCorners[closestArcIdx], mercatorCorners[(closestArcIdx + 1) % 4]);
        vec3.scale(mercatorMidpoint, mercatorMidpoint, .5);
        // Interpolate globe extremum toward Mercator midpoint
        interpolateVec3(arcExtremum, mercatorMidpoint, phase);
    }

    for (const corner of corners) {
        vec3.min(cornerMin, cornerMin, corner);
        vec3.max(cornerMax, cornerMax, corner);
    }

    // Reduce height of the aabb to match height of the closest arc. This reduces false positives
    // of tiles farther away from the center as they would otherwise intersect with far end
    // of the view frustum
    cornerMin[2] = Math.min(arcStart[2], arcEnd[2]);

    vec3.min(cornerMin, cornerMin, arcExtremum);
    vec3.max(cornerMax, cornerMax, arcExtremum);

    return new Aabb(cornerMin, cornerMax);
}

export function tileCornersToBounds({x, y, z}: CanonicalTileID): LngLatBounds {
    const s = 1.0 / (1 << z);
    const sw = new LngLat(lngFromMercatorX(x * s), latFromMercatorY((y + 1) * s));
    const ne = new LngLat(lngFromMercatorX((x + 1) * s), latFromMercatorY(y * s));
    return new LngLatBounds(sw, ne);
}

function mercatorTileCornersInCameraSpace({x, y, z}: CanonicalTileID, numTiles: number, mercatorScale: number, camX: number, camY: number): Array<Vec3> {

    const tileScale = 1.0 / (1 << z);
    // Values in Mercator coordinates (0 - 1)
    let w = x * tileScale;
    let e = w + tileScale;
    let n = y * tileScale;
    let s = n + tileScale;

    // // Ensure that the tile viewed is the nearest when across the antimeridian
    let wrap = 0;
    const tileCenterXFromCamera = (w + e) / 2  - camX;
    if (tileCenterXFromCamera > .5) {
        wrap = -1;
    } else if (tileCenterXFromCamera < -.5) {
        wrap = 1;
    }

    camX *= numTiles;
    camY *= numTiles;

    //  Transform Mercator coordinates to points on the plane tangent to the globe at cameraCenter.
    w  = ((w + wrap) * numTiles - camX) * mercatorScale + camX;
    e  = ((e + wrap) * numTiles - camX) * mercatorScale + camX;
    n  = (n * numTiles - camY) * mercatorScale + camY;
    s  = (s * numTiles - camY) * mercatorScale + camY;

    return [[w, s, 0],
        [e, s, 0],
        [e, n, 0],
        [w, n, 0]];
}

function boundsToECEF(bounds: LngLatBounds): Array<Vec3> {
    const ny = degToRad(bounds.getNorth());
    const sy = degToRad(bounds.getSouth());
    const cosN = Math.cos(ny);
    const cosS = Math.cos(sy);
    const sinN = Math.sin(ny);
    const sinS = Math.sin(sy);
    const w = bounds.getWest();
    const e = bounds.getEast();
    return [
        csLatLngToECEF(cosS, sinS, w),
        csLatLngToECEF(cosS, sinS, e),
        csLatLngToECEF(cosN, sinN, e),
        csLatLngToECEF(cosN, sinN, w)
    ];
}

function csLatLngToECEF(cosLat: number, sinLat: number, lng: number, radius: number = GLOBE_RADIUS): Vec3 {
    lng = degToRad(lng);

    // Convert lat & lng to spherical representation. Use zoom=0 as a reference
    const sx = cosLat * Math.sin(lng) * radius;
    const sy = -sinLat * radius;
    const sz = cosLat * Math.cos(lng) * radius;

    return [sx, sy, sz];
}

export function ecefToLatLng([x, y, z]: Array<number>): LngLat {
    const radius = Math.hypot(x, y, z);
    const lng = Math.atan2(x, z);
    const lat = Math.PI * 0.5 - Math.acos(-y / radius);

    return new LngLat(radToDeg(lng), radToDeg(lat));
}

export function latLngToECEF(lat: number, lng: number, radius?: number): Vec3 {
    assert(lat <= 90 && lat >= -90, 'Lattitude must be between -90 and 90');
    return csLatLngToECEF(Math.cos(degToRad(lat)), Math.sin(degToRad(lat)), lng, radius);
}

export function tileCoordToECEF(x: number, y: number, id: CanonicalTileID, radius?: number): Vec3 {
    const tileCount = 1 << id.z;
    const mercatorX = (x / EXTENT + id.x) / tileCount;
    const mercatorY = (y / EXTENT + id.y) / tileCount;
    const lat = latFromMercatorY(mercatorY);
    const lng = lngFromMercatorX(mercatorX);
    const pos = latLngToECEF(lat, lng, radius);
    return pos;
}

export function globeECEFOrigin(tileMatrix: Mat4, id: UnwrappedTileID): [number, number, number] {
    const origin = [0, 0, 0];
    const bounds = globeTileBounds(id.canonical);
    const normalizationMatrix = globeNormalizeECEF(bounds);
    vec3.transformMat4(origin, origin, normalizationMatrix);
    vec3.transformMat4(origin, origin, tileMatrix);
    return origin;
}

export function globeECEFNormalizationScale({min, max}: Aabb): number {
    return GLOBE_NORMALIZATION_MASK / Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
}

// avoid redundant allocations by sharing the same typed array for normalization/denormalization matrices;
// we never use multiple instances of these at the same time, but this might change, so let's be careful here!
const tempMatrix = new Float64Array(16);

export function globeNormalizeECEF(bounds: Aabb): Float64Array {
    const scale = globeECEFNormalizationScale(bounds);
    const m = mat4.fromScaling(tempMatrix, [scale, scale, scale]);
    return mat4.translate(m, m, vec3.negate([], bounds.min));
}

export function globeDenormalizeECEF(bounds: Aabb): Float64Array {
    const m = mat4.fromTranslation(tempMatrix, bounds.min);
    const scale = 1.0 / globeECEFNormalizationScale(bounds);
    return mat4.scale(m, m, [scale, scale, scale]);
}

export function globeECEFUnitsToPixelScale(worldSize: number): number {
    const localRadius = EXTENT / (2.0 * Math.PI);
    const wsRadius = worldSize / (2.0 * Math.PI);
    return wsRadius / localRadius;
}

export function globePixelsToTileUnits(zoom: number, id: CanonicalTileID): number {
    const ecefPerPixel = EXTENT / (TILE_SIZE * Math.pow(2, zoom));
    const normCoeff = globeECEFNormalizationScale(globeTileBounds(id));

    return ecefPerPixel * normCoeff;
}

function calculateGlobePosMatrix(x, y, worldSize, lng, lat): Float64Array {
    // transform the globe from reference coordinate space to world space
    const scale = globeECEFUnitsToPixelScale(worldSize);
    const offset = [x, y, -worldSize / (2.0 * Math.PI)];
    const m = mat4.identity(new Float64Array(16));
    mat4.translate(m, m, offset);
    mat4.scale(m, m, [scale, scale, scale]);
    mat4.rotateX(m, m, degToRad(-lat));
    mat4.rotateY(m, m, degToRad(-lng));
    return m;
}

export function calculateGlobeMatrix(tr: Transform): Float64Array {
    const {x, y} = tr.point;
    const {lng, lat} = tr._center;
    return calculateGlobePosMatrix(x, y, tr.worldSize, lng, lat);
}

export function calculateGlobeLabelMatrix(tr: Transform, id: CanonicalTileID): Float64Array {
    const {x, y} = tr.point;

    // Map aligned label space for globe view is the non-rotated globe itself in pixel coordinates.

    // Camera is moved closer towards the ground near poles as part of
    // compesanting the reprojection. This has to be compensated for the
    // map aligned label space. Whithout this logic map aligned symbols
    // would appear larger than intended.
    const m = calculateGlobePosMatrix(x, y, tr.worldSize / tr._pixelsPerMercatorPixel, 0, 0);
    return mat4.multiply(m, m, globeDenormalizeECEF(globeTileBounds(id)));
}

export function calculateGlobeMercatorMatrix(tr: Transform): Float32Array {
    const zScale = tr.pixelsPerMeter;
    const ws = zScale / mercatorZfromAltitude(1, tr.center.lat);

    const posMatrix = mat4.identity(new Float64Array(16));
    mat4.translate(posMatrix, posMatrix, [tr.point.x, tr.point.y, 0.0]);
    mat4.scale(posMatrix, posMatrix, [ws, ws, zScale]);

    return Float32Array.from(posMatrix);
}

export function globeToMercatorTransition(zoom: number): number {
    return smoothstep(GLOBE_ZOOM_THRESHOLD_MIN, GLOBE_ZOOM_THRESHOLD_MAX, zoom);
}

export function globeMatrixForTile(id: CanonicalTileID, globeMatrix: Float64Array): Float32Array {
    const decode = globeDenormalizeECEF(globeTileBounds(id));
    return mat4.mul(mat4.create(), globeMatrix, decode);
}

export function globePoleMatrixForTile(z: number, x: number, tr: Transform): Float32Array {
    const poleMatrix = mat4.identity(new Float64Array(16));

    // Rotate the pole triangle fan to the correct location
    const numTiles = 1 << z;
    const xOffsetAngle = (x / numTiles - 0.5) * Math.PI * 2.0;
    mat4.rotateY(poleMatrix, tr.globeMatrix, xOffsetAngle);

    return Float32Array.from(poleMatrix);
}

export function globeUseCustomAntiAliasing(painter: Painter, context: Context, transform: Transform): boolean {
    const transitionT = globeToMercatorTransition(transform.zoom);
    const useContextAA = painter.style.map._antialias;
    const hasStandardDerivatives = !!context.extStandardDerivatives;
    const disabled = context.extStandardDerivativesForceOff || (painter.terrain && painter.terrain.exaggeration() > 0.0);
    return transitionT === 0.0 && !useContextAA && !disabled && hasStandardDerivatives;
}

export function getGridMatrix(id: CanonicalTileID, bounds: LngLatBounds, latitudinalLod: number, worldSize: number): Mat4 {
    const n = bounds.getNorth();
    const s = bounds.getSouth();
    const w = bounds.getWest();
    const e = bounds.getEast();

    // Construct transformation matrix for converting tile coordinates into LatLngs
    const tiles = 1 << id.z;
    const tileWidth = e - w;
    const tileHeight = n - s;
    const tileToLng = tileWidth / GLOBE_VERTEX_GRID_SIZE;
    const tileToLat = -tileHeight / GLOBE_LATITUDINAL_GRID_LOD_TABLE[latitudinalLod];

    const matrix = [0, tileToLng, 0, tileToLat, 0, 0, n, w, 0];

    if (id.z > 0) {
        // Add slight padding to patch seams between tiles.
        // This is done by extruding vertices by a fixed amount. Pixel padding
        // is first converted to degrees and then to tile units before being
        // applied to the final transformation matrix.
        const pixelPadding = 0.5;
        const padding = pixelPadding * 360.0 / worldSize;

        const xScale = padding / tileWidth + 1;
        const yScale = padding / tileHeight + 1;
        const padMatrix = [xScale, 0, 0, 0, yScale, 0, -0.5 * padding / tileToLng, 0.5 * padding / tileToLat, 1];

        mat3.multiply(matrix, matrix, padMatrix);
    }

    // Embed additional variables to the last row of the matrix
    matrix[2] = tiles;
    matrix[5] = id.x;
    matrix[8] = id.y;

    return matrix;
}

export function getLatitudinalLod(lat: number): number {
    const UPPER_LATITUDE = MAX_MERCATOR_LATITUDE - 5.0;
    lat = clamp(lat, -UPPER_LATITUDE, UPPER_LATITUDE) / UPPER_LATITUDE * 90.0;
    // const t = Math.pow(1.0 - Math.cos(degToRad(lat)), 2);
    const t = Math.pow(Math.abs(Math.sin(degToRad(lat))), 3);
    const lod = Math.round(t * (GLOBE_LATITUDINAL_GRID_LOD_TABLE.length - 1));
    return lod;
}

export function globeCenterToScreenPoint(tr: Transform): Point {
    const pos = [0, 0, 0];
    const matrix = mat4.identity(new Float64Array(16));
    mat4.multiply(matrix, tr.pixelMatrix, tr.globeMatrix);
    vec3.transformMat4(pos, pos, matrix);
    return new Point(pos[0], pos[1]);
}

function cameraPositionInECEF(tr: Transform): Array<number> {
    // Here "center" is the center of the globe. We refer to transform._center
    // (the surface of the map on the center of the screen) as "pivot" to avoid confusion.
    const centerToPivot = latLngToECEF(tr._center.lat, tr._center.lng);

    // Set axis to East-West line tangent to sphere at pivot
    const south = vec3.fromValues(0, 1, 0);
    let axis = vec3.cross([], south, centerToPivot);

    // Rotate axis around pivot by bearing
    const rotation = mat4.fromRotation([], -tr.angle, centerToPivot);
    axis = vec3.transformMat4(axis, axis, rotation);

    // Rotate camera around axis by pitch
    mat4.fromRotation(rotation, -tr._pitch, axis);

    const pivotToCamera = vec3.normalize([], centerToPivot);
    vec3.scale(pivotToCamera, pivotToCamera, tr.cameraToCenterDistance / tr.pixelsPerMeter * GLOBE_METERS_TO_ECEF);
    vec3.transformMat4(pivotToCamera, pivotToCamera, rotation);

    return vec3.add([], centerToPivot, pivotToCamera);
}

// Return the angle of the normal vector at a point on the globe relative to the camera.
// i.e. how much to tilt map-aligned markers.
export function globeTiltAtLngLat(tr: Transform, lngLat: LngLat): number {
    const centerToPoint = latLngToECEF(lngLat.lat, lngLat.lng);
    const centerToCamera = cameraPositionInECEF(tr);
    const pointToCamera = vec3.subtract([], centerToCamera, centerToPoint);
    return vec3.angle(pointToCamera, centerToPoint);
}

export function isLngLatBehindGlobe(tr: Transform, lngLat: LngLat): boolean {
    // We consider 1% past the horizon not occluded, this allows popups to be dragged around the globe edge without fading.
    return (globeTiltAtLngLat(tr, lngLat) > Math.PI / 2 * 1.01);
}

/**
 * Check if poles are visible inside the current viewport
 *
 * @param {Transform} transform The current map transform.
 * @returns {[boolean, boolean]} A tuple of booleans [northInViewport, southInViewport]
 */
export function polesInViewport(tr: Transform): [boolean, boolean] {
    // Create matrix from ECEF to screen coordinates
    const ecefToScreenMatrix = mat4.identity(new Float64Array(16));
    mat4.multiply(ecefToScreenMatrix, tr.pixelMatrix, tr.globeMatrix);

    const north = [0, GLOBE_MIN, 0];
    const south = [0, GLOBE_MAX, 0];

    // Translate the poles from ECEF to screen coordinates
    vec3.transformMat4(north, north, ecefToScreenMatrix);
    vec3.transformMat4(south, south, ecefToScreenMatrix);

    // Check if the poles are inside the viewport and not behind the globe surface
    const northInViewport =
        north[0] > 0 && north[0] <= tr.width &&
        north[1] > 0 && north[1] <= tr.height &&
        !isLngLatBehindGlobe(tr, new LngLat(tr.center.lat, 90));

    const southInViewport =
        south[0] > 0 && south[0] <= tr.width &&
        south[1] > 0 && south[1] <= tr.height &&
        !isLngLatBehindGlobe(tr, new LngLat(tr.center.lat, -90));

    return [northInViewport, southInViewport];
}

const POLE_RAD = degToRad(85.0);
const POLE_COS = Math.cos(POLE_RAD);
const POLE_SIN = Math.sin(POLE_RAD);

export class GlobeSharedBuffers {
    _poleNorthVertexBuffer: VertexBuffer;
    _poleSouthVertexBuffer: VertexBuffer;
    _poleIndexBuffer: IndexBuffer;
    _poleSegments: Array<SegmentVector>;

    _gridBuffer: VertexBuffer;
    _gridIndexBuffer: IndexBuffer;
    _gridSegments: Array<SegmentVector>;

    _wireframeIndexBuffer: IndexBuffer;
    _wireframeSegments: Array<SegmentVector>;

    constructor(context: Context) {
        this._createGrid(context);
        this._createPoles(context);
    }

    destroy() {
        this._poleIndexBuffer.destroy();
        this._gridBuffer.destroy();
        this._gridIndexBuffer.destroy();
        this._poleNorthVertexBuffer.destroy();
        this._poleSouthVertexBuffer.destroy();
        for (const segments of this._poleSegments) segments.destroy();
        for (const segments of this._gridSegments) segments.destroy();

        if (this._wireframeIndexBuffer) {
            this._wireframeIndexBuffer.destroy();
            for (const segments of this._wireframeSegments) segments.destroy();
        }
    }

    _createGrid(context: Context) {
        const gridVertices = new PosArray();
        const gridIndices = new TriangleIndexArray();

        const quadExt = GLOBE_VERTEX_GRID_SIZE;
        const vertexExt = quadExt + 1;

        for (let j = 0; j < vertexExt; j++)
            for (let i = 0; i < vertexExt; i++)
                gridVertices.emplaceBack(i, j);

        this._gridSegments = [];
        for (let k = 0, primitiveOffset = 0; k < GLOBE_LATITUDINAL_GRID_LOD_TABLE.length; k++) {
            const latitudinalLod = GLOBE_LATITUDINAL_GRID_LOD_TABLE[k];
            for (let j = 0; j < latitudinalLod; j++) {
                for (let i = 0; i < quadExt; i++) {
                    const index = j * vertexExt + i;
                    gridIndices.emplaceBack(index + 1, index, index + vertexExt);
                    gridIndices.emplaceBack(index + vertexExt, index + vertexExt + 1, index + 1);
                }
            }

            const numVertices = (latitudinalLod + 1) * vertexExt;
            const numPrimitives = latitudinalLod * quadExt * 2;

            this._gridSegments.push(SegmentVector.simpleSegment(0, primitiveOffset, numVertices, numPrimitives));
            primitiveOffset += numPrimitives;
        }

        this._gridBuffer = context.createVertexBuffer(gridVertices, posAttributes.members);
        this._gridIndexBuffer = context.createIndexBuffer(gridIndices, true);
    }

    _createPoles(context: Context) {
        const poleIndices = new TriangleIndexArray();
        for (let i = 0; i <= GLOBE_VERTEX_GRID_SIZE; i++) {
            poleIndices.emplaceBack(0, i + 1, i + 2);
        }
        this._poleIndexBuffer = context.createIndexBuffer(poleIndices, true);

        const northVertices = new GlobeVertexArray();
        const southVertices = new GlobeVertexArray();
        const polePrimitives = GLOBE_VERTEX_GRID_SIZE;
        const poleVertices = GLOBE_VERTEX_GRID_SIZE + 2;
        this._poleSegments = [];

        for (let zoom = 0, offset = 0; zoom < GLOBE_ZOOM_THRESHOLD_MIN; zoom++) {
            const tiles = 1 << zoom;
            const endAngle = 360.0 / tiles;

            northVertices.emplaceBack(0, -GLOBE_RADIUS, 0, 0.5, 0); // place the tip
            southVertices.emplaceBack(0, -GLOBE_RADIUS, 0, 0.5, 1);

            for (let i = 0; i <= GLOBE_VERTEX_GRID_SIZE; i++) {
                const uvX = i / GLOBE_VERTEX_GRID_SIZE;
                const angle = interpolate(0, endAngle, uvX);
                const [gx, gy, gz] = csLatLngToECEF(POLE_COS, POLE_SIN, angle, GLOBE_RADIUS);
                northVertices.emplaceBack(gx, gy, gz, uvX, 0);
                southVertices.emplaceBack(gx, gy, gz, uvX, 1);
            }

            this._poleSegments.push(SegmentVector.simpleSegment(offset, 0, poleVertices, polePrimitives));

            offset += poleVertices;
        }

        this._poleNorthVertexBuffer = context.createVertexBuffer(northVertices, globeLayoutAttributes, false);
        this._poleSouthVertexBuffer = context.createVertexBuffer(southVertices, globeLayoutAttributes, false);
    }

    getGridBuffers(latitudinalLod: number): [VertexBuffer, IndexBuffer, SegmentVector] {
        return [this._gridBuffer, this._gridIndexBuffer, this._gridSegments[latitudinalLod]];
    }

    getPoleBuffers(z: number): [VertexBuffer, VertexBuffer, IndexBuffer, SegmentVector] {
        return [this._poleNorthVertexBuffer, this._poleSouthVertexBuffer, this._poleIndexBuffer, this._poleSegments[z]];
    }

    getWirefameBuffers(context: Context, lod: number): [VertexBuffer, IndexBuffer, SegmentVector] {
        if (!this._wireframeSegments) {
            const wireframeIndices = new LineIndexArray();
            const quadExt = GLOBE_VERTEX_GRID_SIZE;
            const vertexExt = quadExt + 1;

            this._wireframeSegments = [];
            for (let k = 0, primitiveOffset = 0; k < GLOBE_LATITUDINAL_GRID_LOD_TABLE.length; k++) {
                const latitudinalLod = GLOBE_LATITUDINAL_GRID_LOD_TABLE[k];
                for (let j = 0; j < latitudinalLod; j++) {
                    for (let i = 0; i < quadExt; i++) {
                        const index = j * vertexExt + i;
                        wireframeIndices.emplaceBack(index, index + 1);
                        wireframeIndices.emplaceBack(index, index + vertexExt);
                        wireframeIndices.emplaceBack(index, index + vertexExt + 1);
                    }
                }

                const numVertices = (latitudinalLod + 1) * vertexExt;
                const numPrimitives = latitudinalLod * quadExt * 3;

                this._wireframeSegments.push(SegmentVector.simpleSegment(0, primitiveOffset, numVertices, numPrimitives));
                primitiveOffset += numPrimitives;
            }

            this._wireframeIndexBuffer = context.createIndexBuffer(wireframeIndices);
        }
        return [this._gridBuffer, this._wireframeIndexBuffer, this._wireframeSegments[lod]];
    }
}
