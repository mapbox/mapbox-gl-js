// @flow

import {mat4, vec3} from 'gl-matrix';

import {Aabb} from '../../util/primitives.js';
import EXTENT from '../../data/extent.js';
import {degToRad, clamp} from '../../util/util.js';
import {lngFromMercatorX, latFromMercatorY, mercatorZfromAltitude, mercatorXfromLng, mercatorYfromLat} from '../mercator_coordinate.js';
import CanonicalTileID, { UnwrappedTileID } from '../../source/tile_id.js';
import Context from '../../gl/context.js';
import IndexBuffer from '../../gl/index_buffer.js';
import VertexBuffer from '../../gl/vertex_buffer.js';
import SegmentVector from '../../data/segment.js';
import {TriangleIndexArray} from '../../data/array_types.js';

class GlobeTileTransform {
    _tr: Transform;
    _worldSize: number;
    _globeMatrix: Float64Array;

    constructor(tr: Transform, worldSize: number) {
        this._tr = tr;
        this._worldSize = worldSize;

        this._globeMatrix = this._calculateGlobeMatrix();
    }

    createLabelPlaneMatrix(posMatrix: mat4, tileID: CanonicalTileID, pitchWithMap: boolean, rotateWithMap: boolean, pixelsToTileUnits): mat4 {
        let m = mat4.create();
        if (pitchWithMap) {
            m = this._calculateGlobeLabelMatrix(tileID, this._tr.worldSize / this._tr._projectionScaler, this._tr.center.lat, this._tr.center.lng);

            //_calculateGlobeLabelMatrix(tileID: CanonicalTileID, worldSize: number, lat: number, lng: number) {

            if (!rotateWithMap) {
                // const rot = mat4.identity([]);
                // mat4.rotateZ(rot, rot, transform.angle);
                // m = mat4.multiply(rot, rot, m);
                mat4.rotateZ(m, m, this._tr.angle);
            }
        } else {
            mat4.multiply(m, this._tr.labelPlaneMatrix, posMatrix);
        }
        return m;
    }

    createGlCoordMatrix(posMatrix: mat4, tileID: CanonicalTileID, pitchWithMap: boolean, rotateWithMap: boolean, pixelsToTileUnits): mat4 {
        if (pitchWithMap) {
            const m = this.createLabelPlaneMatrix(posMatrix, tileID, pitchWithMap, rotateWithMap, pixelsToTileUnits);
            mat4.invert(m, m);
            mat4.multiply(m, posMatrix, m);
            return m;
        } else {
            return this._tr.glCoordMatrix;
        }
    }

    createTileMatrix(id: UnwrappedTileID): Float64Array {
        const decode = denormalizeECEF(tileBoundsOnGlobe(id.canonical));
        return mat4.multiply([], this._globeMatrix, decode);
    }

    tileAabb(id: UnwrappedTileID, z: number, minZ: number, maxZ: number) {
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
        var vec = this.normalUpVector(id, x, y);
        const pixelsPerMeter = mercatorZfromAltitude(1, 0.0) * EXTENT;
        vec3.scale(vec, vec, pixelsPerMeter);
        return vec;
    }

    normalUpVector(id: CanonicalTileID, x: Number, y: number): vec3 {
        return new GlobeTile(id).upVector(x / EXTENT, y / EXTENT);
    }

    tileSpaceUpVector(): vec3 {
        const pixelsPerMeter = mercatorZfromAltitude(1, this._tr.center.lat) * this._tr.worldSize;
        return [0, 0, pixelsPerMeter];
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
        //const altitudeScaler = 1.0 - mercatorZfromAltitude(1, 0) / mercatorZfromAltitude(1, this.center.lat);
        //const ws = this.worldSize / (1.0 - altitudeScaler);
        //const ws = this.worldSize / this._projectionScaler;
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

    cullTile(aabb: Aabb, id: CanonicalTileID, camera: FreeCamera): boolean {

        // Perform backface culling to exclude tiles facing away from the camera
        // Exclude zoom levels 0 and 1 as probability of a tile facing away is small
        if (id.z <= 1) {
            return true;
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

        return numFacingAway < 4;
    }
};

export default {
    name: 'globe',
    project(lng: number, lat: number) {
        return { x: 0, y: 0, z: 0 };
    },

    projectTilePoint(x: number, y: number, id: CanonicalTileID): {x:number, y: number, z:number} {
        const tiles = Math.pow(2.0, id.z);
        //const mx = (p.x / 8192.0 + tiles / 2) / tiles;
        const mx = (x / 8192.0 + id.x) / tiles;
        const my = (y / 8192.0 + id.y) / tiles;
        const lat = latFromMercatorY(my);
        const lng = lngFromMercatorX(mx);
        const pos = latLngToECEF(lat, lng);

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

    createTileTransform(tr: Transform, worldSize: number): TileTransform {
        return new GlobeTileTransform(tr, worldSize);
    },

    tileAabb(id: UnwrappedTileID, z: number, min: number, max: number) {

        // const aabb = tileBoundsOnGlobe(id);

        // // Transform corners of the aabb to the correct space
        // const corners = aabb.getCorners();

        // const mx = Number.MAX_VALUE;
        // const max = [-mx, -mx, -mx];
        // const min = [mx, mx, mx];

        // for (let i = 0; i < corners.length; i++) {
        //     vec3.transformMat4(corners[i], corners[i], globeMatrix);
        //     vec3.min(min, min, corners[i]);
        //     vec3.max(max, max, corners[i]);
        // }

        // return new Aabb(min, max);

        return null;
    },
}

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

export function tileLatLngCorners(id: CanonicalTileID, padding: ?number) {
    const tileScale = Math.pow(2, id.z);
    const left = id.x / tileScale;
    const right = (id.x + 1) / tileScale;
    const top = id.y / tileScale;
    const bottom = (id.y + 1) / tileScale;

    const latLngTL = [ latFromMercatorY(top), lngFromMercatorX(left) ];
    const latLngBR = [ latFromMercatorY(bottom), lngFromMercatorX(right) ];

    return [latLngTL, latLngBR];
}

export function latLngToECEF(lat, lng, radius) {
    lat = degToRad(lat);
    lng = degToRad(lng);

    if (!radius)
        radius = globeRefRadius;

    // Convert lat & lng to spherical representation. Use zoom=0 as a reference
    const sx = Math.cos(lat) * Math.sin(lng) * radius;
    const sy = -Math.sin(lat) * radius;
    const sz = Math.cos(lat) * Math.cos(lng) * radius;

    return [sx, sy, sz];
}

const normBitRange = 15;

export function normalizeECEF(bounds: Aabb): Float64Array {
    const m = mat4.identity(new Float64Array(16));
    //return m;

    const maxExtInv = 1.0 / Math.max(...vec3.sub([], bounds.max, bounds.min));
    //const size = vec3.div([], [1.0, 1.0, 1.0], vec3.sub([], bounds.max, bounds.min));
    const st = (1 << (normBitRange - 1)) - 1;

    mat4.scale(m, m, [st, st, st]);
    mat4.scale(m, m, [maxExtInv, maxExtInv, maxExtInv]);
    //mat4.scale(m, m, size);
    mat4.translate(m, m, vec3.negate([], bounds.min));

    return m;
}

export function denormalizeECEF(bounds: Aabb): Float64Array {
    const m = mat4.identity(new Float64Array(16));
    //return m;

    const maxExt = Math.max(...vec3.sub([], bounds.max, bounds.min));

    // Denormalize points to the correct range
    const st = 1.0 / ((1 << (normBitRange - 1)) - 1);
    mat4.translate(m, m, bounds.min);
    //mat4.scale(m, m, vec3.sub([], bounds.max, bounds.min));
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
    }

    destroy() {
        this.poleIndexBuffer.destroy();
        this.gridIndexBuffer.destroy();
        this.poleSegments.destroy();
        this.gridSegments.destroy();
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

    constructor(tileID: CanonicalTileID, labelSpace = false) {
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

            // Normalize
            const bounds = tileBoundsOnGlobe(tileID);

            const norm = mat4.identity(new Float64Array(16));
            const maxExtInv = 1.0 / Math.max(...vec3.sub([], bounds.max, bounds.min));
            const st = (1 << (normBitRange - 1)) - 1;

            mat4.scale(norm, norm, [st * maxExtInv, st * maxExtInv, st * maxExtInv]);

            vec3.transformMat4(this._tlUp, this._tlUp, norm);
            vec3.transformMat4(this._trUp, this._trUp, norm);
            vec3.transformMat4(this._blUp, this._blUp, norm);
            vec3.transformMat4(this._brUp, this._brUp, norm);
        } else {
            //const pixelsPerMeter = mercatorZfromAltitude(1, 0.0) * (1 << tileID.canonical.z) * 512.0;
            const pixelsPerMeter = labelSpace;// mercatorZfromAltitude(1, 60.0) * labelSpace;

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