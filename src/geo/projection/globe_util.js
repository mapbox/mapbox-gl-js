// @flow
import {
    lngFromMercatorX,
    latFromMercatorY,
    mercatorZfromAltitude,
    mercatorXfromLng,
    mercatorYfromLat,
    MAX_MERCATOR_LATITUDE
} from '../mercator_coordinate.js';
import EXTENT from '../../data/extent.js';
import {number as interpolate} from '../../style-spec/util/interpolate.js';
import {degToRad, smoothstep, clamp} from '../../util/util.js';
import {mat4, vec3} from 'gl-matrix';
import SegmentVector from '../../data/segment.js';
import {members as globeLayoutAttributes, atmosphereLayout} from '../../terrain/globe_attributes.js';
import posAttributes from '../../data/pos_attributes.js';
import {TriangleIndexArray, GlobeVertexArray, GlobeAtmosphereVertexArray, LineIndexArray, PosArray} from '../../data/array_types.js';
import {Aabb} from '../../util/primitives.js';
import LngLatBounds from '../lng_lat_bounds.js';

import type {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id.js';
import type Context from '../../gl/context.js';
import type {Mat4, Vec3} from 'gl-matrix';
import type IndexBuffer from '../../gl/index_buffer.js';
import type VertexBuffer from '../../gl/vertex_buffer.js';
import type Transform from '../transform.js';

export const GLOBE_RADIUS = EXTENT / Math.PI / 2.0;
const GLOBE_NORMALIZATION_BIT_RANGE = 15;
const GLOBE_NORMALIZATION_MASK = (1 << (GLOBE_NORMALIZATION_BIT_RANGE - 1)) - 1;
const GLOBE_VERTEX_GRID_SIZE = 64;
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
    const [min, max] = globeTileLatLngCorners(id);

    const corners = [
        latLngToECEF(min[0], min[1]),
        latLngToECEF(min[0], max[1]),
        latLngToECEF(max[0], min[1]),
        latLngToECEF(max[0], max[1])
    ];

    const bMin = [GLOBE_MAX, GLOBE_MAX, GLOBE_MAX];
    const bMax = [GLOBE_MIN, GLOBE_MIN, GLOBE_MIN];

    for (const p of corners) {
        bMin[0] = Math.min(bMin[0], p[0]);
        bMin[1] = Math.min(bMin[1], p[1]);
        bMin[2] = Math.min(bMin[2], p[2]);

        bMax[0] = Math.max(bMax[0], p[0]);
        bMax[1] = Math.max(bMax[1], p[1]);
        bMax[2] = Math.max(bMax[2], p[2]);
    }

    return new Aabb(bMin, bMax);
}

export function aabbForTileOnGlobe(tr: Transform, numTiles: number, tileId: CanonicalTileID): Aabb {
    const scale = numTiles / tr.worldSize;
    const to1to1Units = (cornerMin: Vec3, cornerMax: Vec3) => {
        vec3.scale(cornerMin, cornerMin, scale);
        vec3.scale(cornerMax, cornerMax, scale);
    };

    const mx = Number.MAX_VALUE;
    const cornerMax = [-mx, -mx, -mx];
    const cornerMin = [mx, mx, mx];
    const m = calculateGlobeMatrix(tr);

    if (tileId.z <= 1) {
        // Compute minimum bounding box that fully encapsulates
        // transformed corners of the local aabb
        const aabb = globeTileBounds(tileId);
        const corners = aabb.getCorners();

        for (let i = 0; i < corners.length; i++) {
            vec3.transformMat4(corners[i], corners[i], m);
            vec3.min(cornerMin, cornerMin, corners[i]);
            vec3.max(cornerMax, cornerMax, corners[i]);
        }

        to1to1Units(cornerMin, cornerMax);
        return new Aabb(cornerMin, cornerMax);
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
    const [nw, se] = globeTileLatLngCorners(tileId);
    const bounds = new LngLatBounds();
    bounds.setSouthWest([nw[1], se[0]]);
    bounds.setNorthEast([se[1], nw[0]]);

    const corners = [
        latLngToECEF(bounds.getSouth(), bounds.getWest()),
        latLngToECEF(bounds.getSouth(), bounds.getEast()),
        latLngToECEF(bounds.getNorth(), bounds.getEast()),
        latLngToECEF(bounds.getNorth(), bounds.getWest())
    ];

    // Note that here we're transforming the corners to world space while finding the min/max values.
    for (let i = 0; i < corners.length; i++) {
        vec3.transformMat4(corners[i], corners[i], m);
        vec3.min(cornerMin, cornerMin, corners[i]);
        vec3.max(cornerMax, cornerMax, corners[i]);
    }

    if (bounds.contains(tr.center)) {
        cornerMax[2] = 0.0;
        to1to1Units(cornerMin, cornerMax);
        return new Aabb(cornerMin, cornerMax);
    }

    // Compute parameters describing edges of the tile (i.e. arcs) on the globe surface.
    // Vertical edges revolves around the globe origin whereas horizontal edges revolves around the y-axis.
    const globeCenter = [m[12], m[13], m[14]];

    const centerLng = tr.center.lng;
    const centerLat = clamp(tr.center.lat, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
    const center = [mercatorXfromLng(centerLng), mercatorYfromLat(centerLat)];

    const tileCenterLng = bounds.getCenter().lng;
    const tileCenterLat = clamp(bounds.getCenter().lat, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
    const tileCenter = [mercatorXfromLng(tileCenterLng), mercatorYfromLat(tileCenterLat)];
    let arcCenter = new Array(3);
    let closestArcIdx = 0;

    const dx = center[0] - tileCenter[0];
    const dy = center[1] - tileCenter[1];

    // Here we determine the arc which is closest to the map center point.
    // Horizontal arcs origin = globeCenter.
    // Vertical arcs origin = globeCenter + yAxis * shift.
    // Where `shift` is determined by latitude.
    if (Math.abs(dx) > Math.abs(dy)) {
        closestArcIdx = dx >= 0 ? 1 : 3;
        arcCenter = globeCenter;
    } else {
        closestArcIdx = dy >= 0 ? 0 : 2;
        const yAxis = [m[4], m[5], m[6]];
        let shift: number;
        if (dy >= 0) {
            shift = -Math.sin(degToRad(bounds.getSouth())) * GLOBE_RADIUS;
        } else {
            shift = -Math.sin(degToRad(bounds.getNorth())) * GLOBE_RADIUS;
        }
        arcCenter = vec3.scaleAndAdd(arcCenter, globeCenter, yAxis, shift);
    }

    const arcA = corners[closestArcIdx];
    const arcB = corners[(closestArcIdx + 1) % 4];

    const closestArc = new Arc(arcA, arcB, arcCenter);
    const arcBounds = [(localExtremum(closestArc, 0) || arcA[0]),
        (localExtremum(closestArc, 1) || arcA[1]),
        (localExtremum(closestArc, 2) || arcA[2])];

    // Reduce height of the aabb to match height of the closest arc. This reduces false positives
    // of tiles farther away from the center as they would otherwise intersect with far end
    // of the view frustum
    cornerMin[2] = Math.min(arcA[2], arcB[2]);

    vec3.min(cornerMin, cornerMin, arcBounds);
    vec3.max(cornerMax, cornerMax, arcBounds);

    to1to1Units(cornerMin, cornerMax);
    return new Aabb(cornerMin, cornerMax);
}

export function globeTileLatLngCorners(id: CanonicalTileID): [[number, number], [number, number]] {
    const tileScale = 1 << id.z;
    const left = id.x / tileScale;
    const right = (id.x + 1) / tileScale;
    const top = id.y / tileScale;
    const bottom = (id.y + 1) / tileScale;

    const latLngTL = [ latFromMercatorY(top), lngFromMercatorX(left) ];
    const latLngBR = [ latFromMercatorY(bottom), lngFromMercatorX(right) ];

    return [latLngTL, latLngBR];
}

function csLatLngToECEF(cosLat: number, sinLat: number, lng: number, radius: number = GLOBE_RADIUS): Array<number> {
    lng = degToRad(lng);

    // Convert lat & lng to spherical representation. Use zoom=0 as a reference
    const sx = cosLat * Math.sin(lng) * radius;
    const sy = -sinLat * radius;
    const sz = cosLat * Math.cos(lng) * radius;

    return [sx, sy, sz];
}

export function latLngToECEF(lat: number, lng: number, radius?: number): Array<number> {
    return csLatLngToECEF(Math.cos(degToRad(lat)), Math.sin(degToRad(lat)), lng, radius);
}

export function tileCoordToECEF(x: number, y: number, id: CanonicalTileID): Array<number> {
    const tiles = Math.pow(2.0, id.z);
    const mx = (x / EXTENT + id.x) / tiles;
    const my = (y / EXTENT + id.y) / tiles;
    const lat = latFromMercatorY(my);
    const lng = lngFromMercatorX(mx);
    const pos = latLngToECEF(lat, lng);
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

export function globeECEFNormalizationScale(bounds: Aabb): number {
    const maxExt = Math.max(...vec3.sub([], bounds.max, bounds.min));
    return GLOBE_NORMALIZATION_MASK / maxExt;
}

export function globeNormalizeECEF(bounds: Aabb): Float64Array {
    const m = mat4.identity(new Float64Array(16));
    const scale = globeECEFNormalizationScale(bounds);
    mat4.scale(m, m, [scale, scale, scale]);
    mat4.translate(m, m, vec3.negate([], bounds.min));
    return m;
}

export function globeDenormalizeECEF(bounds: Aabb): Float64Array {
    const m = mat4.identity(new Float64Array(16));
    const scale = 1.0 / globeECEFNormalizationScale(bounds);
    mat4.translate(m, m, bounds.min);
    mat4.scale(m, m, [scale, scale, scale]);
    return m;
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
    const {lng, lat} = tr._center;
    // Camera is moved closer towards the ground near poles as part of
    // compesanting the reprojection. This has to be compensated for the
    // map aligned label space. Whithout this logic map aligned symbols
    // would appear larger than intended.
    const m = calculateGlobePosMatrix(0, 0, tr.worldSize / tr._projectionScaler, lng, lat);
    return mat4.multiply(m, m, globeDenormalizeECEF(globeTileBounds(id)));
}

export function calculateGlobeMercatorMatrix(tr: Transform): Float32Array {
    const worldSize = tr.worldSize;
    const point = tr.point;

    const mercatorZ = mercatorZfromAltitude(1, tr.center.lat) * worldSize;
    const projectionScaler = mercatorZ / tr.pixelsPerMeter;
    const zScale = tr.pixelsPerMeter;
    const ws = worldSize / projectionScaler;

    const posMatrix = mat4.identity(new Float64Array(16));
    mat4.translate(posMatrix, posMatrix, [point.x, point.y, 0.0]);
    mat4.scale(posMatrix, posMatrix, [ws, ws, zScale]);

    return Float32Array.from(posMatrix);
}

export const GLOBE_ZOOM_THRESHOLD_MIN = 5;
export const GLOBE_ZOOM_THRESHOLD_MAX = 6;

export function globeToMercatorTransition(zoom: number): number {
    return smoothstep(GLOBE_ZOOM_THRESHOLD_MIN, GLOBE_ZOOM_THRESHOLD_MAX, zoom);
}

export function globeMatrixForTile(id: CanonicalTileID, globeMatrix: Float64Array): Float32Array {
    const decode = globeDenormalizeECEF(globeTileBounds(id));
    return mat4.mul(mat4.create(), globeMatrix, decode);
}

export function globePoleMatrixForTile(z: number, x: number, tr: Transform): Float32Array {
    const poleMatrix = mat4.identity(new Float64Array(16));
    const numTiles = 1 << z;
    const xOffsetAngle = (x / numTiles - 0.5) * 360;
    const point = tr.point;
    const ws = tr.worldSize;
    const s = tr.worldSize / (tr.tileSize * numTiles);

    mat4.translate(poleMatrix, poleMatrix, [point.x, point.y, -(ws / Math.PI / 2.0)]);
    mat4.scale(poleMatrix, poleMatrix, [s, s, s]);
    mat4.rotateX(poleMatrix, poleMatrix, degToRad(-tr._center.lat));
    mat4.rotateY(poleMatrix, poleMatrix, degToRad(-tr._center.lng + xOffsetAngle));

    return Float32Array.from(poleMatrix);
}

export function getGridMatrix(id: CanonicalTileID, corners: [[number, number], [number, number]]): Array<number> {
    const [tl, br] = corners;
    const S = 1.0 / GLOBE_VERTEX_GRID_SIZE;
    const x = (br[1] - tl[1]) * S;
    const y = (br[0] - tl[0]) * S;
    const tileZoom = 1 << id.z;
    return [0, x, tileZoom, y, 0, id.y, tl[0], tl[1], S];
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
    _gridSegments: SegmentVector;

    atmosphereVertexBuffer: VertexBuffer;
    atmosphereIndexBuffer: IndexBuffer;
    atmosphereSegments: SegmentVector;

    _wireframeIndexBuffer: IndexBuffer;
    _wireframeSegments: SegmentVector;

    constructor(context: Context) {
        this._createGrid(context);
        this._createPoles(context);
        this._createAtmosphere(context);
    }

    destroy() {
        this._poleIndexBuffer.destroy();
        this._gridBuffer.destroy();
        this._gridIndexBuffer.destroy();
        this._poleNorthVertexBuffer.destroy();
        this._poleSouthVertexBuffer.destroy();
        for (const segments of this._poleSegments) segments.destroy();
        this._gridSegments.destroy();
        this.atmosphereVertexBuffer.destroy();
        this.atmosphereIndexBuffer.destroy();
        this.atmosphereSegments.destroy();

        if (this._wireframeIndexBuffer) {
            this._wireframeIndexBuffer.destroy();
            this._wireframeSegments.destroy();
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

        for (let j = 0; j < quadExt; j++) {
            for (let i = 0; i < quadExt; i++) {
                const index = j * vertexExt + i;
                gridIndices.emplaceBack(index + 1, index, index + vertexExt);
                gridIndices.emplaceBack(index + vertexExt, index + vertexExt + 1, index + 1);
            }
        }

        const numVertices = vertexExt * vertexExt;
        const numPrimitives = quadExt * quadExt * 2;

        this._gridBuffer = context.createVertexBuffer(gridVertices, posAttributes.members);
        this._gridIndexBuffer = context.createIndexBuffer(gridIndices, true);
        this._gridSegments = SegmentVector.simpleSegment(0, 0, numVertices, numPrimitives);
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
            const radius = tiles * TILE_SIZE / Math.PI / 2.0;
            const endAngle = 360.0 / tiles;

            northVertices.emplaceBack(0, -radius, 0, 0, 0, 0.5, 0); // place the tip
            southVertices.emplaceBack(0, -radius, 0, 0, 0, 0.5, 1);

            for (let i = 0; i <= GLOBE_VERTEX_GRID_SIZE; i++) {
                const uvX = i / GLOBE_VERTEX_GRID_SIZE;
                const angle = interpolate(0, endAngle, uvX);
                const [gx, gy, gz] = csLatLngToECEF(POLE_COS, POLE_SIN, angle, radius);
                northVertices.emplaceBack(gx, gy, gz, 0, 0, uvX, 0);
                southVertices.emplaceBack(gx, gy, gz, 0, 0, uvX, 1);
            }

            this._poleSegments.push(SegmentVector.simpleSegment(offset, 0, poleVertices, polePrimitives));

            offset += poleVertices;
        }

        this._poleNorthVertexBuffer = context.createVertexBuffer(northVertices, globeLayoutAttributes, false);
        this._poleSouthVertexBuffer = context.createVertexBuffer(southVertices, globeLayoutAttributes, false);
    }

    _createAtmosphere(context: Context) {
        const atmosphereVertices = new GlobeAtmosphereVertexArray();
        atmosphereVertices.emplaceBack(-1, 1, 1, 0, 0);
        atmosphereVertices.emplaceBack(1, 1, 1, 1, 0);
        atmosphereVertices.emplaceBack(1, -1, 1, 1, 1);
        atmosphereVertices.emplaceBack(-1, -1, 1, 0, 1);

        const atmosphereTriangles = new TriangleIndexArray();
        atmosphereTriangles.emplaceBack(0, 1, 2);
        atmosphereTriangles.emplaceBack(2, 3, 0);

        this.atmosphereVertexBuffer = context.createVertexBuffer(atmosphereVertices, atmosphereLayout.members);
        this.atmosphereIndexBuffer = context.createIndexBuffer(atmosphereTriangles);
        this.atmosphereSegments = SegmentVector.simpleSegment(0, 0, 4, 2);
    }

    getGridBuffers(): [VertexBuffer, IndexBuffer, SegmentVector] {
        return [this._gridBuffer, this._gridIndexBuffer, this._gridSegments];
    }

    getPoleBuffers(z: number): [VertexBuffer, VertexBuffer, IndexBuffer, SegmentVector] {
        return [this._poleNorthVertexBuffer, this._poleSouthVertexBuffer, this._poleIndexBuffer, this._poleSegments[z]];
    }

    getWirefameBuffers(context: Context): [VertexBuffer, IndexBuffer, SegmentVector] {
        if (!this._wireframeSegments) {
            const wireframeIndices = new LineIndexArray();
            const quadExt = GLOBE_VERTEX_GRID_SIZE;
            const vertexExt = quadExt + 1;

            for (let j = 0; j < quadExt; j++) {
                for (let i = 0; i < quadExt; i++) {
                    const index = j * vertexExt + i;
                    wireframeIndices.emplaceBack(index, index + 1);
                    wireframeIndices.emplaceBack(index, index + vertexExt);
                    wireframeIndices.emplaceBack(index, index + vertexExt + 1);
                }
            }

            this._wireframeIndexBuffer = context.createIndexBuffer(wireframeIndices);
            this._wireframeSegments = SegmentVector.simpleSegment(0, 0, quadExt * quadExt, wireframeIndices.length);
        }
        return [this._gridBuffer, this._wireframeIndexBuffer, this._wireframeSegments];
    }
}
