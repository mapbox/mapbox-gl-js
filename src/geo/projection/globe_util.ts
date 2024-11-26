import MercatorCoordinate, {
    lngFromMercatorX,
    latFromMercatorY,
    mercatorZfromAltitude,
    mercatorXfromLng,
    mercatorYfromLat,
    MAX_MERCATOR_LATITUDE,
} from '../mercator_coordinate';
import EXTENT from '../../style-spec/data/extent';
import {number as interpolate} from '../../style-spec/util/interpolate';
import {degToRad, radToDeg, clamp, smoothstep, getColumn, shortestAngle} from '../../util/util';
import {vec3, vec4, mat3, mat4} from 'gl-matrix';
import SegmentVector from '../../data/segment';
import {members as globeLayoutAttributes} from '../../terrain/globe_attributes';
import posAttributes from '../../data/pos_attributes';
import {TriangleIndexArray, GlobeVertexArray, PosArray} from '../../data/array_types';
import {Aabb, Ray} from '../../util/primitives';
import LngLat, {earthRadius, csLatLngToECEF, latLngToECEF, LngLatBounds} from '../lng_lat';
import {
    GLOBE_RADIUS,
    GLOBE_MIN,
    GLOBE_MAX,
    TILE_SIZE,
    GLOBE_NORMALIZATION_MASK,
    GLOBE_ZOOM_THRESHOLD_MIN,
    GLOBE_ZOOM_THRESHOLD_MAX,
    GLOBE_VERTEX_GRID_SIZE,
    GLOBE_LATITUDINAL_GRID_LOD_TABLE
} from './globe_constants';
import Point from '@mapbox/point-geometry';

import type Painter from '../../render/painter';
import type {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id';
import type Context from '../../gl/context';
import type IndexBuffer from '../../gl/index_buffer';
import type VertexBuffer from '../../gl/vertex_buffer';
import type Transform from '../transform';

export function globeMetersToEcef(d: number): number {
    return d * GLOBE_RADIUS / earthRadius;
}

const GLOBE_LOW_ZOOM_TILE_AABBS = [
    // z == 0
    new Aabb([GLOBE_MIN, GLOBE_MIN, GLOBE_MIN], [GLOBE_MAX, GLOBE_MAX, GLOBE_MAX]),
    // z == 1
    new Aabb([GLOBE_MIN, GLOBE_MIN, GLOBE_MIN], [0, 0, GLOBE_MAX]), // x=0, y=0
    new Aabb([0, GLOBE_MIN, GLOBE_MIN], [GLOBE_MAX, 0, GLOBE_MAX]), // x=1, y=0
    new Aabb([GLOBE_MIN, 0, GLOBE_MIN], [0, GLOBE_MAX, GLOBE_MAX]), // x=0, y=1
    new Aabb([0, 0, GLOBE_MIN], [GLOBE_MAX, GLOBE_MAX, GLOBE_MAX])  // x=1, y=1
];

export function globePointCoordinate(tr: Transform, x: number, y: number, clampToHorizon: boolean = true): MercatorCoordinate | null | undefined {
    const point0 = vec3.scale([] as unknown as vec3, tr._camera.position, tr.worldSize);
    const point1: vec4 = [x, y, 1, 1];

    vec4.transformMat4(point1, point1, tr.pixelMatrixInverse);
    vec4.scale(point1, point1, 1 / point1[3]);

    const p0p1 = vec3.sub([] as unknown as vec3, point1 as unknown as vec3, point0);
    const dir = vec3.normalize([] as unknown as vec3, p0p1);

    // Find closest point on the sphere to the ray. This is a bit more involving operation
    // if the ray is not intersecting with the sphere, in which case we "clamp" the ray
    // to the surface of the sphere, i.e. find a tangent vector that originates from the camera position
    const m = tr.globeMatrix;
    const globeCenter: vec3 = [m[12], m[13], m[14]];
    const p0toCenter = vec3.sub([] as any, globeCenter, point0);
    const p0toCenterDist = vec3.length(p0toCenter);
    const centerDir = vec3.normalize([] as any, p0toCenter);
    const radius = tr.worldSize / (2.0 * Math.PI);
    const cosAngle = vec3.dot(centerDir, dir);

    const origoTangentAngle = Math.asin(radius / p0toCenterDist);
    const origoDirAngle = Math.acos(cosAngle);

    if (origoTangentAngle < origoDirAngle) {
        if (!clampToHorizon) return null;

        // Find the tangent vector by interpolating between camera-to-globe and camera-to-click vectors.
        // First we'll find a point P1 on the clicked ray that forms a right-angled triangle with the camera position
        // and the center of the globe. Angle of the tanget vector is then used as the interpolation factor
        const clampedP1 = [] as unknown as vec3;
        const origoToP1 = [] as unknown as vec3;

        vec3.scale(clampedP1, dir, p0toCenterDist / cosAngle);
        vec3.normalize(origoToP1, vec3.sub(origoToP1, clampedP1, p0toCenter));
        vec3.normalize(dir, vec3.add(dir, p0toCenter, vec3.scale(dir, origoToP1, Math.tan(origoTangentAngle) * p0toCenterDist)));
    }

    const pointOnGlobe = [] as unknown as vec3;
    const ray = new Ray(point0, dir);

    ray.closestPointOnSphere(globeCenter, radius, pointOnGlobe);

    // Transform coordinate axes to find lat & lng of the position
    const xa = vec3.normalize([] as unknown as vec3, getColumn(m, 0) as unknown as vec3);
    const ya = vec3.normalize([] as unknown as vec3, getColumn(m, 1) as unknown as vec3);
    const za = vec3.normalize([] as unknown as vec3, getColumn(m, 2) as unknown as vec3);

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
    constructor(p0: vec3, p1: vec3, center: vec3) {
        this.a = vec3.sub([] as unknown as vec3, p0, center);
        this.b = vec3.sub([] as unknown as vec3, p1, center);
        this.center = center;
        const an = vec3.normalize([] as unknown as vec3, this.a);
        const bn = vec3.normalize([] as unknown as vec3, this.b);
        this.angle = Math.acos(vec3.dot(an, bn));
    }

    a: vec3;
    b: vec3;
    center: vec3;
    angle: number;
}

export function slerp(a: number, b: number, angle: number, t: number): number {
    const sina = Math.sin(angle);
    return a * (Math.sin((1.0 - t) * angle) / sina) + b * (Math.sin(t * angle) / sina);
}

// Computes local extremum point of an arc on one of the dimensions (x, y or z),
// i.e. value of a point where d/dt*f(x,y,t) == 0
export function localExtremum(arc: Arc, dim: number): number | null | undefined {
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

export function interpolateVec3(from: vec3, to: vec3, phase: number): vec3 {
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
    const nw: vec3 = [w, n, 0];
    const ne: vec3 = [e, n, 0];
    const sw: vec3 = [w, s, 0];
    const se: vec3 = [e, s, 0];
    // Transform Mercator globeCorners to ECEF
    const worldToECEFMatrix = mat4.invert([] as unknown as mat4, tr.globeMatrix);
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

function transformPoints(corners: Array<vec3>, globeMatrix: mat4, scale: number) {
    for (const corner of corners) {
        vec3.transformMat4(corner, corner, globeMatrix);
        vec3.scale(corner, corner, scale);
    }
}

// Returns AABB in world/camera space scaled by numTiles / tr.worldSize
// extendToPoles - extend tiles neighboring to north / south pole segments with the north/south pole point
export function aabbForTileOnGlobe(
    tr: Transform,
    numTiles: number,
    tileId: CanonicalTileID,
    extendToPoles: boolean,
): Aabb {
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
    const bounds = tileCornersToBounds(tileId, extendToPoles);

    const corners = boundsToECEF(bounds, GLOBE_RADIUS + globeMetersToEcef(tr._tileCoverLift));

    // Transform the corners to world space
    transformPoints(corners, m, scale);

    const mx = Number.MAX_VALUE;
    const cornerMax: vec3 = [-mx, -mx, -mx];
    const cornerMin: vec3 = [mx, mx, mx];

    // Extend the aabb by including the center point. There are some corner cases where center point is inside the
    // tile but due to curvature aabb computed from corner points does not cover the curved area.
    if (bounds.contains(tr.center)) {

        for (const corner of corners) {
            vec3.min(cornerMin, cornerMin, corner);
            vec3.max(cornerMax, cornerMax, corner);
        }
        cornerMax[2] = 0.0;
        const point = tr.point;
        const center: vec3 = [point.x * scale, point.y * scale, 0];
        vec3.min(cornerMin, cornerMin, center);
        vec3.max(cornerMax, cornerMax, center);

        return new Aabb(cornerMin, cornerMax);
    }

    if (tr._tileCoverLift > 0.0) {
        // Early return for elevated globe tiles, where the tile cover optimization is ignored
        for (const corner of corners) {
            vec3.min(cornerMin, cornerMin, corner);
            vec3.max(cornerMax, cornerMax, corner);
        }
        return new Aabb(cornerMin, cornerMax);
    }

    // Compute arcs describing edges of the tile on the globe surface.
    // Vertical edges revolves around the globe origin whereas horizontal edges revolves around the y-axis.
    const arcCenter: vec3 = [m[12] * scale, m[13] * scale, m[14] * scale];

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
        const yAxis: vec3 = [m[4] * scale, m[5] * scale, m[6] * scale];
        const shift = -Math.sin(degToRad(dy >= 0 ? bounds.getSouth() : bounds.getNorth())) * GLOBE_RADIUS;
        vec3.scaleAndAdd(arcCenter, arcCenter, yAxis, shift);
    }

    const arcStart = corners[closestArcIdx];
    const arcEnd = corners[(closestArcIdx + 1) % 4];

    const closestArc = new Arc(arcStart, arcEnd, arcCenter);
    const arcExtremum: vec3 = [
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
        const mercatorMidpoint = vec3.add([] as any, mercatorCorners[closestArcIdx], mercatorCorners[(closestArcIdx + 1) % 4]);
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

export function tileCornersToBounds(
    {
        x,
        y,
        z,
    }: CanonicalTileID,
    extendToPoles: boolean = false,
): LngLatBounds {
    const s = 1.0 / (1 << z);
    const sw = new LngLat(lngFromMercatorX(x * s), y === (1 << z) - 1 && extendToPoles ? -90 : latFromMercatorY((y + 1) * s));
    const ne = new LngLat(lngFromMercatorX((x + 1) * s), y === 0 && extendToPoles ? 90 : latFromMercatorY(y * s));
    return new LngLatBounds(sw, ne);
}

function mercatorTileCornersInCameraSpace(
    {
        x,
        y,
        z,
    }: CanonicalTileID,
    numTiles: number,
    mercatorScale: number,
    camX: number,
    camY: number,
): Array<vec3> {

    const tileScale = 1.0 / (1 << z);
    // Values in Mercator coordinates (0 - 1)
    let w = x * tileScale;
    let e = w + tileScale;
    let n = y * tileScale;
    let s = n + tileScale;

    // // Ensure that the tile viewed is the nearest when across the antimeridian
    let wrap = 0;
    const tileCenterXFromCamera = (w + e) / 2 - camX;
    if (tileCenterXFromCamera > .5) {
        wrap = -1;
    } else if (tileCenterXFromCamera < -.5) {
        wrap = 1;
    }

    camX *= numTiles;
    camY *= numTiles;

    //  Transform Mercator coordinates to points on the plane tangent to the globe at cameraCenter.
    w = ((w + wrap) * numTiles - camX) * mercatorScale + camX;
    e = ((e + wrap) * numTiles - camX) * mercatorScale + camX;
    n = (n * numTiles - camY) * mercatorScale + camY;
    s = (s * numTiles - camY) * mercatorScale + camY;

    return [[w, s, 0],
        [e, s, 0],
        [e, n, 0],
        [w, n, 0]];
}

function boundsToECEF(bounds: LngLatBounds, radius: number = GLOBE_RADIUS): Array<vec3> {
    const ny = degToRad(bounds.getNorth());
    const sy = degToRad(bounds.getSouth());
    const cosN = Math.cos(ny);
    const cosS = Math.cos(sy);
    const sinN = Math.sin(ny);
    const sinS = Math.sin(sy);
    const w = bounds.getWest();
    const e = bounds.getEast();
    return [
        csLatLngToECEF(cosS, sinS, w, radius),
        csLatLngToECEF(cosS, sinS, e, radius),
        csLatLngToECEF(cosN, sinN, e, radius),
        csLatLngToECEF(cosN, sinN, w, radius)
    ];
}

export function tileCoordToECEF(x: number, y: number, id: CanonicalTileID, radius?: number): [number, number, number] {
    const tileCount = 1 << id.z;
    const mercatorX = (x / EXTENT + id.x) / tileCount;
    const mercatorY = (y / EXTENT + id.y) / tileCount;
    const lat = latFromMercatorY(mercatorY);
    const lng = lngFromMercatorX(mercatorX);
    const pos = latLngToECEF(lat, lng, radius);
    return pos;
}

export function globeECEFOrigin(tileMatrix: mat4, id: UnwrappedTileID): [number, number, number] {
    const origin: vec3 = [0, 0, 0];
    const bounds = globeTileBounds(id.canonical);
    const normalizationMatrix = globeNormalizeECEF(bounds);
    vec3.transformMat4(origin, origin, normalizationMatrix);
    vec3.transformMat4(origin, origin, tileMatrix);
    return origin;
}

export function globeECEFNormalizationScale(
    {
        min,
        max,
    }: Aabb,
): number {
    return GLOBE_NORMALIZATION_MASK / Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
}

// avoid redundant allocations by sharing the same typed array for normalization/denormalization matrices;
// we never use multiple instances of these at the same time, but this might change, so let's be careful here!
const tempMatrix = new Float64Array(16) as unknown as mat4;

export function globeNormalizeECEF(bounds: Aabb): mat4 {
    const scale = globeECEFNormalizationScale(bounds);
    const m = mat4.fromScaling(tempMatrix, [scale, scale, scale]);
    return mat4.translate(m, m, vec3.negate([] as any, bounds.min));
}

export function globeDenormalizeECEF(bounds: Aabb): mat4 {
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

function calculateGlobePosMatrix(x: number, y: number, worldSize: number, lng: number, lat: number): mat4 {
    // transform the globe from reference coordinate space to world space
    const scale = globeECEFUnitsToPixelScale(worldSize);
    const offset: vec3 = [x, y, -worldSize / (2.0 * Math.PI)];
    const m = mat4.identity(new Float64Array(16) as unknown as mat4);
    mat4.translate(m, m, offset);
    mat4.scale(m, m, [scale, scale, scale]);
    mat4.rotateX(m, m, degToRad(-lat));
    mat4.rotateY(m, m, degToRad(-lng));
    return m;
}

export function calculateGlobeMatrix(tr: Transform): mat4 {
    const {x, y} = tr.point;
    const {lng, lat} = tr._center;
    return calculateGlobePosMatrix(x, y, tr.worldSize, lng, lat);
}

export function calculateGlobeLabelMatrix(tr: Transform, id: CanonicalTileID): mat4 {
    const {x, y} = tr.point;

    // Map aligned label space for globe view is the non-rotated globe itself in pixel coordinates.

    // Camera is moved closer towards the ground near poles as part of
    // compesanting the reprojection. This has to be compensated for the
    // map aligned label space. Whithout this logic map aligned symbols
    // would appear larger than intended.
    const m = calculateGlobePosMatrix(x, y, tr.worldSize / tr._pixelsPerMercatorPixel, 0, 0);
    return mat4.multiply(m, m, globeDenormalizeECEF(globeTileBounds(id)));
}

export function calculateGlobeMercatorMatrix(tr: Transform): mat4 {
    const zScale = tr.pixelsPerMeter;
    const ws = zScale / mercatorZfromAltitude(1, tr.center.lat);

    const posMatrix = mat4.identity(new Float64Array(16) as unknown as mat4);
    mat4.translate(posMatrix, posMatrix, [tr.point.x, tr.point.y, 0.0]);
    mat4.scale(posMatrix, posMatrix, [ws, ws, zScale]);

    return Float32Array.from(posMatrix);
}

export function globeToMercatorTransition(zoom: number): number {
    return smoothstep(GLOBE_ZOOM_THRESHOLD_MIN, GLOBE_ZOOM_THRESHOLD_MAX, zoom);
}

export function globeMatrixForTile(id: CanonicalTileID, globeMatrix: mat4): mat4 {
    const decode = globeDenormalizeECEF(globeTileBounds(id));
    return mat4.mul(mat4.create(), globeMatrix, decode);
}

export function globePoleMatrixForTile(z: number, x: number, tr: Transform): mat4 {
    const poleMatrix = mat4.identity(new Float64Array(16) as unknown as mat4);

    // Rotate the pole triangle fan to the correct location
    const numTiles = 1 << z;
    const xOffsetAngle = (x / numTiles - 0.5) * Math.PI * 2.0;
    mat4.rotateY(poleMatrix, tr.globeMatrix, xOffsetAngle);

    return Float32Array.from(poleMatrix);
}

export function globeUseCustomAntiAliasing(painter: Painter, context: Context, transform: Transform): boolean {
    const transitionT = globeToMercatorTransition(transform.zoom);
    const useContextAA = painter.style.map._antialias;
    const disabled = context.options.extStandardDerivativesForceOff || (painter.terrain && painter.terrain.exaggeration() > 0.0);
    return transitionT === 0.0 && !useContextAA && !disabled;
}

export function getGridMatrix(
    id: CanonicalTileID,
    bounds: LngLatBounds,
    latitudinalLod: number,
    worldSize: number,
): mat4 {
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

    const matrix: mat3 = [0, tileToLng, 0, tileToLat, 0, 0, n, w, 0];

    if (id.z > 0) {
        // Add slight padding to patch seams between tiles.
        // This is done by extruding vertices by a fixed amount. Pixel padding
        // is first converted to degrees and then to tile units before being
        // applied to the final transformation matrix.
        const pixelPadding = 0.5;
        const padding = pixelPadding * 360.0 / worldSize;

        const xScale = padding / tileWidth + 1;
        const yScale = padding / tileHeight + 1;
        const padMatrix: mat3 = [xScale, 0, 0, 0, yScale, 0, -0.5 * padding / tileToLng, 0.5 * padding / tileToLat, 1];

        mat3.multiply(matrix, matrix, padMatrix);
    }

    // Embed additional variables to the last row of the matrix
    matrix[2] = tiles;
    matrix[5] = id.x;
    matrix[8] = id.y;

    return matrix as unknown as mat4;
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
    const pos: vec3 = [0, 0, 0];
    const matrix = mat4.identity(new Float64Array(16) as unknown as mat4);
    mat4.multiply(matrix, tr.pixelMatrix, tr.globeMatrix);
    vec3.transformMat4(pos, pos, matrix);
    return new Point(pos[0], pos[1]);
}

function cameraPositionInECEF(tr: Transform): vec3 {
    // Here "center" is the center of the globe. We refer to transform._center
    // (the surface of the map on the center of the screen) as "pivot" to avoid confusion.
    const centerToPivot = latLngToECEF(tr._center.lat, tr._center.lng);

    // Set axis to East-West line tangent to sphere at pivot
    const south = vec3.fromValues(0, 1, 0);
    let axis = vec3.cross([] as any, south, centerToPivot);

    // Rotate axis around pivot by bearing
    const rotation = mat4.fromRotation([] as any, -tr.angle, centerToPivot);
    axis = vec3.transformMat4(axis, axis, rotation);

    // Rotate camera around axis by pitch
    mat4.fromRotation(rotation, -tr._pitch, axis);

    const pivotToCamera = vec3.normalize([] as any, centerToPivot);
    vec3.scale(pivotToCamera, pivotToCamera, globeMetersToEcef(tr.cameraToCenterDistance / tr.pixelsPerMeter));
    vec3.transformMat4(pivotToCamera, pivotToCamera, rotation);

    return vec3.add([] as unknown as vec3, centerToPivot, pivotToCamera);
}

// Return the angle of the normal vector at a point on the globe relative to the camera.
// i.e. how much to tilt map-aligned markers.
export function globeTiltAtLngLat(tr: Transform, lngLat: LngLat): number {
    const centerToPoint = latLngToECEF(lngLat.lat, lngLat.lng);
    const centerToCamera = cameraPositionInECEF(tr);
    const pointToCamera = vec3.subtract([] as unknown as vec3, centerToCamera, centerToPoint);
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
    const ecefToScreenMatrix = mat4.identity(new Float64Array(16) as unknown as mat4);
    mat4.multiply(ecefToScreenMatrix, tr.pixelMatrix, tr.globeMatrix);

    const north: vec3 = [0, GLOBE_MIN, 0];
    const south: vec3 = [0, GLOBE_MAX, 0];

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

// Generate terrain grid with embedded skirts
const EMBED_SKIRTS = true;

type GridLodSegments = {
    withoutSkirts: SegmentVector;
    withSkirts: SegmentVector;
};

type GridWithLods = {
    vertices: PosArray;
    indices: TriangleIndexArray;
    segments: Array<GridLodSegments>;
};

export class GlobeSharedBuffers {
    _poleNorthVertexBuffer: VertexBuffer;
    _poleSouthVertexBuffer: VertexBuffer;
    _texturedPoleNorthVertexBuffer: VertexBuffer;
    _texturedPoleSouthVertexBuffer: VertexBuffer;
    _poleIndexBuffer: IndexBuffer;
    _poleSegments: Array<SegmentVector>;

    _gridBuffer: VertexBuffer;
    _gridIndexBuffer: IndexBuffer;
    _gridSegments: Array<GridLodSegments>;

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
        for (const segments of this._gridSegments) {
            segments.withSkirts.destroy();
            segments.withoutSkirts.destroy();
        }
    }

    // Generate terrain grid vertices and indices for all LOD's
    //
    // Grid vertices memory layout:
    //
    //          First line Skirt
    //          ┌───────────────┐
    //          │┌─────────────┐│
    // Left     ││┼┼┼┼┼┼┼┼┼┼┼┼┼││ Right
    // Border   ││┼┼┼┼┼┼┼┼┼┼┼┼┼││ Border
    // Skirt    │├─────────────┤│ Skirt
    //          ││  Main Grid  ││
    //          │├─────────────┤│
    //          ││┼┼┼┼┼┼┼┼┼┼┼┼┼││
    //          ││┼┼┼┼┼┼┼┼┼┼┼┼┼││
    //          │└─────────────┘│
    //          ├───────────────┤
    //          ├───────────────┤
    //          └───────────────┘
    //      Bottom Skirt = Number of LOD's
    //
    _fillGridMeshWithLods(longitudinalCellsCount: number, latitudinalLods: number[]): GridWithLods {
        const vertices = new PosArray();
        const indices = new TriangleIndexArray();
        const segments: Array<GridLodSegments> = [];

        const xVertices = longitudinalCellsCount + 1 + 2 * (EMBED_SKIRTS ? 1 : 0);
        const yVerticesHighLodNoStrip = latitudinalLods[0] + 1;
        const yVerticesHighLodWithStrip = latitudinalLods[0] + 1 + (EMBED_SKIRTS ? 1 + latitudinalLods.length : 0);

        // Index adjustment, used to make strip (x, y) vertex input attribute data
        // to match same data on ordinary grid edges
        const prepareVertex = (x: number, y: number, isSkirt: boolean) => {
            if (!EMBED_SKIRTS) return [x, y];

            let adjustedX = (() => {
                if (x === xVertices - 1) {
                    return x - 2;
                } else if (x === 0) {
                    return x;
                } else {
                    return x - 1;
                }
            })();

            // Skirt factor is introduces as an offset to the .x coordinate, similar to how it's done for mercator grids
            const skirtOffset = 24575;
            adjustedX += isSkirt ? skirtOffset : 0;

            return [adjustedX, y];
        };

        // Add first horizontal strip if present
        if (EMBED_SKIRTS) {
            for (let x = 0; x < xVertices; ++x) {
                // @ts-expect-error - TS2556 - A spread argument must either have a tuple type or be passed to a rest parameter.
                vertices.emplaceBack(...prepareVertex(x, 0, true));
            }
        }

        // Add main grid part with vertices strips embedded
        for (let y = 0; y < yVerticesHighLodNoStrip; ++y) {
            for (let x = 0; x < xVertices; ++x) {
                const isSideBorder = (x === 0 || x === xVertices - 1);

                // @ts-expect-error - TS2556 - A spread argument must either have a tuple type or be passed to a rest parameter.
                vertices.emplaceBack(...prepareVertex(x, y, isSideBorder && EMBED_SKIRTS));
            }
        }

        // Add bottom strips for each LOD
        if (EMBED_SKIRTS) {
            for (let lodIdx = 0; lodIdx < latitudinalLods.length; ++lodIdx) {
                const lastYRowForLod = latitudinalLods[lodIdx];
                for (let x = 0; x < xVertices; ++x) {
                    // @ts-expect-error - TS2556 - A spread argument must either have a tuple type or be passed to a rest parameter.
                    vertices.emplaceBack(...prepareVertex(x, lastYRowForLod, true));
                }
            }
        }

        // Fill triangles
        for (let lodIdx = 0; lodIdx < latitudinalLods.length; ++lodIdx) {
            const indexOffset = indices.length;

            const yVerticesLod = latitudinalLods[lodIdx] + 1 + 2 * (EMBED_SKIRTS ? 1 : 0);

            const skirtsOnlyIndices = new TriangleIndexArray();

            for (let y = 0; y < yVerticesLod - 1; y++) {
                const isLastLine = (y === yVerticesLod - 2);
                const offsetToNextRow =
                    (isLastLine && EMBED_SKIRTS ?
                        (xVertices * (yVerticesHighLodWithStrip - latitudinalLods.length + lodIdx - y)) :
                        xVertices);

                for (let x = 0; x < xVertices - 1; x++) {
                    const idx = y * xVertices + x;

                    const isSkirt = EMBED_SKIRTS && (y === 0 || isLastLine || x === 0 || x === xVertices - 2);

                    if (isSkirt) {
                        skirtsOnlyIndices.emplaceBack(idx + 1, idx, idx + offsetToNextRow);
                        skirtsOnlyIndices.emplaceBack(idx + offsetToNextRow, idx + offsetToNextRow + 1, idx + 1);
                    } else {
                        indices.emplaceBack(idx + 1, idx, idx + offsetToNextRow);
                        indices.emplaceBack(idx + offsetToNextRow, idx + offsetToNextRow + 1, idx + 1);
                    }
                }
            }

            // Segments grid only
            const withoutSkirts = SegmentVector.simpleSegment(0, indexOffset, vertices.length, indices.length - indexOffset);

            for (let i = 0; i < skirtsOnlyIndices.uint16.length; i += 3) {
                indices.emplaceBack(skirtsOnlyIndices.uint16[i], skirtsOnlyIndices.uint16[i + 1], skirtsOnlyIndices.uint16[i + 2]);
            }

            // Segments grid + skirts only
            const withSkirts = SegmentVector.simpleSegment(0, indexOffset, vertices.length, indices.length - indexOffset);
            segments.push({withoutSkirts, withSkirts});
        }

        return {vertices, indices, segments};
    }

    _createGrid(context: Context) {
        const gridWithLods = this._fillGridMeshWithLods(GLOBE_VERTEX_GRID_SIZE, GLOBE_LATITUDINAL_GRID_LOD_TABLE as unknown as number[]);
        this._gridSegments = gridWithLods.segments;

        this._gridBuffer = context.createVertexBuffer(gridWithLods.vertices, posAttributes.members);
        this._gridIndexBuffer = context.createIndexBuffer(gridWithLods.indices, true);
    }

    _createPoles(context: Context) {
        const poleIndices = new TriangleIndexArray();
        for (let i = 0; i <= GLOBE_VERTEX_GRID_SIZE; i++) {
            poleIndices.emplaceBack(0, i + 1, i + 2);
        }
        this._poleIndexBuffer = context.createIndexBuffer(poleIndices, true);

        const northVertices = new GlobeVertexArray();
        const southVertices = new GlobeVertexArray();
        const texturedNorthVertices = new GlobeVertexArray();
        const texturedSouthVertices = new GlobeVertexArray();
        const polePrimitives = GLOBE_VERTEX_GRID_SIZE;
        const poleVertices = GLOBE_VERTEX_GRID_SIZE + 2;
        this._poleSegments = [];

        for (let zoom = 0, offset = 0; zoom < GLOBE_ZOOM_THRESHOLD_MIN; zoom++) {
            const tiles = 1 << zoom;
            const endAngle = 360.0 / tiles;

            northVertices.emplaceBack(0, -GLOBE_RADIUS, 0, 0.5, 0); // place the tip
            southVertices.emplaceBack(0, -GLOBE_RADIUS, 0, 0.5, 1);
            texturedNorthVertices.emplaceBack(0, -GLOBE_RADIUS, 0, 0.5, 0.5);
            texturedSouthVertices.emplaceBack(0, -GLOBE_RADIUS, 0, 0.5, 0.5);

            for (let i = 0; i <= GLOBE_VERTEX_GRID_SIZE; i++) {
                let uvX = i / GLOBE_VERTEX_GRID_SIZE;
                let uvY = 0.0;
                const angle = interpolate(0, endAngle, uvX);
                const [gx, gy, gz] = csLatLngToECEF(POLE_COS, POLE_SIN, angle, GLOBE_RADIUS);
                northVertices.emplaceBack(gx, gy, gz, uvX, uvY);
                southVertices.emplaceBack(gx, gy, gz, uvX, 1.0 - uvY);
                const rad = degToRad(angle);
                uvX = 0.5 + 0.5 * Math.sin(rad);
                uvY = 0.5 + 0.5 * Math.cos(rad);
                texturedNorthVertices.emplaceBack(gx, gy, gz, uvX, uvY);
                texturedSouthVertices.emplaceBack(gx, gy, gz, uvX, 1.0 - uvY);
            }

            this._poleSegments.push(SegmentVector.simpleSegment(offset, 0, poleVertices, polePrimitives));

            offset += poleVertices;
        }

        this._poleNorthVertexBuffer = context.createVertexBuffer(northVertices, globeLayoutAttributes, false);
        this._poleSouthVertexBuffer = context.createVertexBuffer(southVertices, globeLayoutAttributes, false);
        this._texturedPoleNorthVertexBuffer = context.createVertexBuffer(texturedNorthVertices, globeLayoutAttributes, false);
        this._texturedPoleSouthVertexBuffer = context.createVertexBuffer(texturedSouthVertices, globeLayoutAttributes, false);
    }

    getGridBuffers(latitudinalLod: number, withSkirts: boolean): [VertexBuffer, IndexBuffer, SegmentVector] {
        return [this._gridBuffer, this._gridIndexBuffer, withSkirts ? this._gridSegments[latitudinalLod].withSkirts : this._gridSegments[latitudinalLod].withoutSkirts];
    }

    getPoleBuffers(z: number, textured: boolean): [VertexBuffer, VertexBuffer, IndexBuffer, SegmentVector] {
        return [
            textured ? this._texturedPoleNorthVertexBuffer : this._poleNorthVertexBuffer,
            textured ? this._texturedPoleSouthVertexBuffer : this._poleSouthVertexBuffer,
            this._poleIndexBuffer,
            this._poleSegments[z]
        ];
    }
}
