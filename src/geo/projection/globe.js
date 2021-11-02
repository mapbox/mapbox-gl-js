// @flow

import {mat4, vec4, vec3} from 'gl-matrix';
import {Aabb} from '../../util/primitives.js';
import EXTENT from '../../data/extent.js';
import {degToRad, smoothstep, clamp} from '../../util/util.js';
import MercatorCoordinate, {lngFromMercatorX, latFromMercatorY, mercatorZfromAltitude, mercatorXfromLng, mercatorYfromLat} from '../mercator_coordinate.js';
import {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id.js';
import Context from '../../gl/context.js';
import IndexBuffer from '../../gl/index_buffer.js';
import SegmentVector from '../../data/segment.js';
import {atmosphereLayout} from '../../terrain/globe_attributes.js';
import type VertexBuffer from '../../gl/vertex_buffer.js';
import {TriangleIndexArray, GlobeVertexArray} from '../../data/array_types.js';
import {FreeCamera} from '../../ui/free_camera.js';
import type Transform from '../transform.js';

class GlobeTileTransform {
    _tr: Transform;
    _worldSize: number;
    _globeMatrix: Float64Array;

    constructor(tr: Transform, worldSize: number) {
        this._tr = tr;
        this._worldSize = worldSize;

        this._globeMatrix = this._calculateGlobeMatrix();
    }

    createLabelPlaneMatrix(posMatrix: mat4, tileID: CanonicalTileID, pitchWithMap: boolean, rotateWithMap: boolean): mat4 {
        let m = mat4.create();
        if (pitchWithMap) {
            m = this._calculateGlobeLabelMatrix(tileID, this._tr.worldSize / this._tr._projectionScaler, this._tr.center.lat, this._tr.center.lng);

            if (!rotateWithMap) {
                mat4.rotateZ(m, m, this._tr.angle);
            }
        } else {
            mat4.multiply(m, this._tr.labelPlaneMatrix, posMatrix);
        }
        return m;
    }

    createGlCoordMatrix(posMatrix: mat4, tileID: CanonicalTileID, pitchWithMap: boolean, rotateWithMap: boolean): mat4 {
        if (pitchWithMap) {
            const m = this.createLabelPlaneMatrix(posMatrix, tileID, pitchWithMap, rotateWithMap);
            mat4.invert(m, m);
            mat4.multiply(m, posMatrix, m);
            return m;
        } else {
            return this._tr.glCoordMatrix;
        }
    }

    createTileMatrix(id: UnwrappedTileID): mat4 {
        const decode = denormalizeECEF(tileBoundsOnGlobe(id.canonical));
        return mat4.multiply([], this._globeMatrix, decode);
    }

    createInversionMatrix(id: UnwrappedTileID): mat4 {
        const center = this._tr.center;
        const localRadius = EXTENT / (2.0 * Math.PI);
        const wsRadiusGlobe = this._worldSize / (2.0 * Math.PI);
        const sGlobe = wsRadiusGlobe / localRadius;

        const matrix = mat4.identity(new Float64Array(16));
        mat4.scale(matrix, matrix, [sGlobe, sGlobe, 1.0]);
        mat4.rotateX(matrix, matrix, degToRad(-center.lat));
        mat4.rotateY(matrix, matrix, degToRad(-center.lng));

        const decode = denormalizeECEF(tileBoundsOnGlobe(id.canonical));
        mat4.multiply(matrix, matrix, decode);
        mat4.invert(matrix, matrix);

        const z = mercatorZfromAltitude(1, center.lat) * this._worldSize;
        const projectionScaler = z / this._tr.pixelsPerMeter;

        const ws = this._worldSize / projectionScaler;
        const wsRadiusScaled = ws / (2.0 * Math.PI);
        const sMercator = wsRadiusScaled / localRadius;

        const scaling = mat4.identity(new Float64Array(16));
        mat4.scale(scaling, scaling, [sMercator, sMercator, 1.0]);

        return mat4.multiply(matrix, matrix, scaling);
    }

    tileAabb(id: UnwrappedTileID) {
        const aabb = tileBoundsOnGlobe(id.canonical);

        // Transform corners of the aabb to the correct space
        const corners = aabb.getCorners();

        const mx = Number.MAX_VALUE;
        const max = [-mx, -mx, -mx];
        const min = [mx, mx, mx];

        for (let i = 0; i < corners.length; i++) {
            vec3.transformMat4(corners[i], corners[i], this._globeMatrix);
            vec3.min(min, min, corners[i]);
            vec3.max(max, max, corners[i]);
        }

        return new Aabb(min, max);
    }

    upVector(id: CanonicalTileID, x: number, y: number): vec3 {
        return new GlobeTile(id).upVector(x / EXTENT, y / EXTENT);
    }

    upVectorScale(id: CanonicalTileID): number {
        const pixelsPerMeterECEF = mercatorZfromAltitude(1, 0.0) * 2.0 * globeRefRadius * Math.PI;
        const maxTileScale = tileNormalizationScale(id);
        return pixelsPerMeterECEF * maxTileScale;
    }

    tileSpaceUpVectorScale(): number {
        return mercatorZfromAltitude(1, this._tr.center.lat) * this._tr.worldSize;
    }

    _calculateGlobeMatrix() {
        const localRadius = EXTENT / (2.0 * Math.PI);
        const wsRadius = this._worldSize / (2.0 * Math.PI);
        const s = wsRadius / localRadius;

        const lat = clamp(this._tr.center.lat, -this._tr.maxValidLatitude, this._tr.maxValidLatitude);
        const x = mercatorXfromLng(this._tr.center.lng) * this._worldSize;
        const y = mercatorYfromLat(lat) * this._worldSize;

        // transform the globe from reference coordinate space to world space
        const posMatrix = mat4.identity(new Float64Array(16));
        mat4.translate(posMatrix, posMatrix, [x, y, -wsRadius]);
        mat4.scale(posMatrix, posMatrix, [s, s, s]);
        mat4.rotateX(posMatrix, posMatrix, degToRad(-this._tr._center.lat));
        mat4.rotateY(posMatrix, posMatrix, degToRad(-this._tr._center.lng));

        return posMatrix;
    }

    _calculateGlobeLabelMatrix(tileID: CanonicalTileID, worldSize: number, lat: number, lng: number) {

        // Camera is moved closer towards the ground near poles as part of compesanting the reprojection.
        // This has to be compensated for the map aligned label space.
        // Whithout this logic map aligned symbols would appear larger than intended
        const ws = worldSize;

        const localRadius = EXTENT / (2.0 * Math.PI);
        const wsRadius = ws / (2.0 * Math.PI);
        const s = wsRadius / localRadius;

        // transform the globe from reference coordinate space to world space
        const posMatrix = mat4.identity(new Float64Array(16));

        mat4.translate(posMatrix, posMatrix, [0, 0, -wsRadius]);
        mat4.scale(posMatrix, posMatrix, [s, s, s]);
        mat4.rotateX(posMatrix, posMatrix, degToRad(-lat));
        mat4.rotateY(posMatrix, posMatrix, degToRad(-lng));

        return mat4.multiply([], posMatrix, denormalizeECEF(tileBoundsOnGlobe(tileID)));
    }

    pointCoordinate(x: number, y: number): MercatorCoordinate {
        const p0 = [x, y, 0, 1];
        const p1 = [x, y, 1, 1];

        vec4.transformMat4(p0, p0, this._tr.pixelMatrixInverse);
        vec4.transformMat4(p1, p1, this._tr.pixelMatrixInverse);

        vec4.scale(p0, p0, 1 / p0[3]);
        vec4.scale(p1, p1, 1 / p1[3]);

        const p0p1 = vec3.sub([], p1, p0);
        const dir = vec3.normalize([], p0p1);

        // Compute globe origo in world space
        const matrix = this._calculateGlobeMatrix();
        const center = vec3.transformMat4([], [0, 0, 0], matrix);
        const radius = this._worldSize / (2.0 * Math.PI);

        const oc = vec3.sub([], p0, center);
        const a = vec3.dot(dir, dir);
        const b = 2.0 * vec3.dot(oc, dir);
        const c = vec3.dot(oc, oc) - radius * radius;
        const d = b * b - 4 * a * c;
        let pOnGlobe;

        if (d < 0) {
            // Not intersecting with the globe. Find shortest distance between the ray and the globe
            const t = clamp(vec3.dot(vec3.negate([], oc), p0p1) / vec3.dot(p0p1, p0p1), 0, 1);
            const pointOnRay = vec3.lerp([], p0, p1, t);
            const pointToGlobe = vec3.sub([], center, pointOnRay);

            pOnGlobe = vec3.sub([], vec3.add([], pointOnRay, vec3.scale([], pointToGlobe, (1.0 - radius / vec3.length(pointToGlobe)))), center);
        } else {
            const t = (-b - Math.sqrt(d)) / (2.0 * a);
            pOnGlobe = vec3.sub([], vec3.scaleAndAdd([], p0, dir, t), center);
        }

        // Transform coordinate axes to find lat & lng of the position
        const xa = vec3.normalize([], vec4.transformMat4([], [1, 0, 0, 0], matrix));
        const ya = vec3.normalize([], vec4.transformMat4([], [0, -1, 0, 0], matrix));
        const za = vec3.normalize([], vec4.transformMat4([], [0, 0, 1, 0], matrix));

        const lat = Math.asin(vec3.dot(ya, pOnGlobe) / radius) * 180 / Math.PI;
        const xp = vec3.dot(xa, pOnGlobe);
        const zp = vec3.dot(za, pOnGlobe);
        const lng = Math.atan2(xp, zp) * 180 / Math.PI;

        return new MercatorCoordinate(mercatorXfromLng(lng), mercatorYfromLat(lat));
    }

    cullTile(aabb: Aabb, id: CanonicalTileID, zoom: number, camera: FreeCamera): boolean {

        if (zoom >= GLOBE_ZOOM_THRESHOLD_MIN) {
            return false;
        }

        // Perform backface culling to exclude tiles facing away from the camera
        // Exclude zoom levels 0 and 1 as probability of a tile facing away is small
        if (id.z <= 1) {
            return false;
        }

        const fwd = camera.forward();
        const [min, max] = tileLatLngCorners(id);

        const corners = [
            vec3.transformMat4([], latLngToECEF(min[0], min[1]), this._globeMatrix),
            vec3.transformMat4([], latLngToECEF(min[0], max[1]), this._globeMatrix),
            vec3.transformMat4([], latLngToECEF(max[0], min[1]), this._globeMatrix),
            vec3.transformMat4([], latLngToECEF(max[0], max[1]), this._globeMatrix)
        ];

        const globeOrigo = vec3.transformMat4([], [0, 0, 0], this._globeMatrix);

        let numFacingAway = 0;

        for (let i = 0; i < corners.length; i++) {
            const p = corners[i];
            const dir = vec3.sub([], p, globeOrigo);

            if (vec3.dot(dir, fwd) >= 0) {
                numFacingAway++;
            }
        }

        return numFacingAway === 4;
    }
}

export default {
    name: 'globe',
    project() {
        return {x: 0, y: 0, z: 0};
    },

    projectTilePoint(x: number, y: number, id: CanonicalTileID): {x: number, y: number, z: number} {
        const tiles = Math.pow(2.0, id.z);
        const mx = (x / EXTENT + id.x) / tiles;
        const my = (y / EXTENT + id.y) / tiles;
        const lat = latFromMercatorY(my);
        const lng = lngFromMercatorX(mx);
        const pos = latLngToECEF(lat, lng);

        // eslint-disable-next-line no-warning-comments
        // TODO: cached matrices!
        const bounds = tileBoundsOnGlobe(id);
        const normalizationMatrix = normalizeECEF(bounds);
        vec3.transformMat4(pos, pos, normalizationMatrix);

        return {x: pos[0], y: pos[1], z: pos[2]};
    },

    requiresDraping: true,
    supportsWorldCopies: false,
    zAxisUnit: "pixels",

    pixelsPerMeter(lat: number, worldSize: number) {
        return mercatorZfromAltitude(1, 0) * worldSize;
    },

    createTileTransform(tr: Transform, worldSize: number): Object {
        return new GlobeTileTransform(tr, worldSize);
    },
};

export const globeRefRadius = EXTENT / Math.PI / 2.0;

export function tileBoundsOnGlobe(id: CanonicalTileID): Aabb {
    const z = id.z;

    const mn = -globeRefRadius;
    const mx = globeRefRadius;

    if (z === 0) {
        return new Aabb([mn, mn, mn], [mx, mx, mx]);
    } else if (z === 1) {
        if (id.x === 0 && id.y === 0) {
            return new Aabb([mn, mn, mn], [0, 0, mx]);
        } else if (id.x === 1 && id.y === 0) {
            return new Aabb([0, mn, mn], [mx, 0, mx]);
        } else if (id.x === 0 && id.y === 1) {
            return new Aabb([mn, 0, mn], [0, mx, mx]);
        } else if (id.x === 1 && id.y === 1) {
            return new Aabb([0, 0, mn], [mx, mx, mx]);
        }
    }

    // After zoom 1 surface function is monotonic for all tile patches
    // => it is enough to project corner points
    const [min, max] = tileLatLngCorners(id);

    const corners = [
        latLngToECEF(min[0], min[1], globeRefRadius),
        latLngToECEF(min[0], max[1], globeRefRadius),
        latLngToECEF(max[0], min[1], globeRefRadius),
        latLngToECEF(max[0], max[1], globeRefRadius)
    ];

    const bMin = [mx, mx, mx];
    const bMax = [mn, mn, mn];

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

export function tileNormalizationScale(id: CanonicalTileID) {
    const bounds = tileBoundsOnGlobe(id);
    const maxExtInv = 1.0 / Math.max(...vec3.sub([], bounds.max, bounds.min));
    const st = (1 << (normBitRange - 1)) - 1;
    return st * maxExtInv;
}

export function tileLatLngCorners(id: CanonicalTileID) {
    const tileScale = Math.pow(2, id.z);
    const left = id.x / tileScale;
    const right = (id.x + 1) / tileScale;
    const top = id.y / tileScale;
    const bottom = (id.y + 1) / tileScale;

    const latLngTL = [ latFromMercatorY(top), lngFromMercatorX(left) ];
    const latLngBR = [ latFromMercatorY(bottom), lngFromMercatorX(right) ];

    return [latLngTL, latLngBR];
}

export function latLngToECEF(lat: number, lng: number, radius: ?number): Array<number> {
    lat = degToRad(lat);
    lng = degToRad(lng);

    if (!radius) {
        radius = globeRefRadius;
    }

    // Convert lat & lng to spherical representation. Use zoom=0 as a reference
    const sx = Math.cos(lat) * Math.sin(lng) * radius;
    const sy = -Math.sin(lat) * radius;
    const sz = Math.cos(lat) * Math.cos(lng) * radius;

    return [sx, sy, sz];
}

const normBitRange = 15;

export function normalizeECEF(bounds: Aabb): Float64Array {
    const m = mat4.identity(new Float64Array(16));

    const maxExtInv = 1.0 / Math.max(...vec3.sub([], bounds.max, bounds.min));
    const st = (1 << (normBitRange - 1)) - 1;

    mat4.scale(m, m, [st, st, st]);
    mat4.scale(m, m, [maxExtInv, maxExtInv, maxExtInv]);
    mat4.translate(m, m, vec3.negate([], bounds.min));

    return m;
}

export const GLOBE_ZOOM_THRESHOLD_MIN = 5;
export const GLOBE_ZOOM_THRESHOLD_MAX = 6;

export function globeToMercatorTransition(zoom: number): number {
    return smoothstep(GLOBE_ZOOM_THRESHOLD_MIN, GLOBE_ZOOM_THRESHOLD_MAX, zoom);
}

export function denormalizeECEF(bounds: Aabb): Float64Array {
    const m = mat4.identity(new Float64Array(16));

    const maxExt = Math.max(...vec3.sub([], bounds.max, bounds.min));

    // Denormalize points to the correct range
    const st = 1.0 / ((1 << (normBitRange - 1)) - 1);
    mat4.translate(m, m, bounds.min);
    mat4.scale(m, m, [maxExt, maxExt, maxExt]);
    mat4.scale(m, m, [st, st, st]);

    return m;
}

export const GLOBE_VERTEX_GRID_SIZE = 128;

export class GlobeSharedBuffers {
    poleIndexBuffer: IndexBuffer;
    poleSegments: SegmentVector;

    gridIndexBuffer: IndexBuffer;
    gridSegments: SegmentVector;

    atmosphereVertexBuffer: VertexBuffer;
    atmosphereIndexBuffer: IndexBuffer;
    atmosphereSegments: SegmentVector;

    constructor(context: Context) {
        const gridIndices = this._createGridIndices(GLOBE_VERTEX_GRID_SIZE);
        this.gridIndexBuffer = context.createIndexBuffer(gridIndices, true);

        const gridPrimitives = GLOBE_VERTEX_GRID_SIZE * GLOBE_VERTEX_GRID_SIZE * 2;
        const gridVertices = (GLOBE_VERTEX_GRID_SIZE + 1) * (GLOBE_VERTEX_GRID_SIZE + 1);
        this.gridSegments = SegmentVector.simpleSegment(0, 0, gridVertices, gridPrimitives);

        const poleIndices = this._createPoleTriangleIndices(GLOBE_VERTEX_GRID_SIZE);
        this.poleIndexBuffer = context.createIndexBuffer(poleIndices, true);

        const polePrimitives = GLOBE_VERTEX_GRID_SIZE;
        const poleVertices = GLOBE_VERTEX_GRID_SIZE + 2;
        this.poleSegments = SegmentVector.simpleSegment(0, 0, poleVertices, polePrimitives);

        const atmosphereVertices = new GlobeVertexArray();
        atmosphereVertices.emplaceBack(-1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0);
        atmosphereVertices.emplaceBack(1.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0);
        atmosphereVertices.emplaceBack(1.0, -1.0, 1.0, 0.0, 0.0, 1.0, 1.0);
        atmosphereVertices.emplaceBack(-1.0, -1.0, 1.0, 0.0, 0.0, 0.0, 1.0);

        const atmosphereTriangles = new TriangleIndexArray();
        atmosphereTriangles.emplaceBack(0, 1, 2);
        atmosphereTriangles.emplaceBack(2, 3, 0);

        this.atmosphereVertexBuffer = context.createVertexBuffer(atmosphereVertices, atmosphereLayout.members);
        this.atmosphereIndexBuffer = context.createIndexBuffer(atmosphereTriangles);
        this.atmosphereSegments = SegmentVector.simpleSegment(0, 0, 4, 2);
    }

    destroy() {
        this.poleIndexBuffer.destroy();
        this.gridIndexBuffer.destroy();
        this.poleSegments.destroy();
        this.gridSegments.destroy();
        this.atmosphereVertexBuffer.destroy();
        this.atmosphereIndexBuffer.destroy();
        this.atmosphereSegments.destroy();
    }

    _createPoleTriangleIndices(fanSize: number): TriangleIndexArray {
        const arr = new TriangleIndexArray();
        for (let i = 0; i <= fanSize; i++) {
            arr.emplaceBack(0, i + 1, i + 2);
        }
        return arr;
    }

    _createGridIndices(count: number): TriangleIndexArray {
        const indexArray = new TriangleIndexArray();
        const quadExt = count;
        const vertexExt = quadExt + 1;
        const quad = (i, j) => {
            const index = j * vertexExt + i;
            indexArray.emplaceBack(index + 1, index, index + vertexExt);
            indexArray.emplaceBack(index + vertexExt, index + vertexExt + 1, index + 1);
        };
        for (let j = 0; j < quadExt; j++) {
            for (let i = 0; i < quadExt; i++) {
                quad(i, j);
            }
        }
        return indexArray;
    }
}

export class GlobeTile {
    tileID: CanonicalTileID;
    _tlUp: Array<number>;
    _trUp: Array<number>;
    _blUp: Array<number>;
    _brUp: Array<number>;

    constructor(tileID: CanonicalTileID, labelSpace: boolean = false) {
        this.tileID = tileID;

        // Pre-compute up vectors of each corner of the tile
        const corners = tileLatLngCorners(tileID);
        const tl = corners[0];
        const br = corners[1];

        this._tlUp = latLngToECEF(tl[0], tl[1]);
        this._trUp = latLngToECEF(tl[0], br[1]);
        this._brUp = latLngToECEF(br[0], br[1]);
        this._blUp = latLngToECEF(br[0], tl[1]);

        if (!labelSpace) {
            vec3.normalize(this._tlUp, this._tlUp);
            vec3.normalize(this._trUp, this._trUp);
            vec3.normalize(this._brUp, this._brUp);
            vec3.normalize(this._blUp, this._blUp);
        } else {
            this._tlUp = [0, 0, 1];
            this._trUp = [0, 0, 1];
            this._brUp = [0, 0, 1];
            this._blUp = [0, 0, 1];
        }
    }

    upVector(u: number, v: number): Array<number> {
        return vec3.lerp([],
            vec3.lerp([], this._tlUp, this._trUp, u),
            vec3.lerp([], this._blUp, this._brUp, u),
            v);
    }
}
