// @flow

import {mat4, vec3} from 'gl-matrix';

import {Aabb} from '../../util/primitives.js';
import EXTENT from '../../data/extent.js';
import {degToRad, clamp} from '../../util/util.js';
import {lngFromMercatorX, latFromMercatorY, mercatorZfromAltitude, mercatorXfromLng, mercatorYfromLat} from '../mercator_coordinate.js';
import CanonicalTileID, { UnwrappedTileID } from '../../source/tile_id.js';

class GlobeTileTransform {
    _tr: Transform;
    _worldSize: number;
    _globeMatrix: Float64Array;

    constructor(tr: Transform, worldSize: number) {
        this._tr = tr;
        this._worldSize = worldSize;

        this._globeMatrix = this._calculateGlobeMatrix();
    }

    createTileMatrix(id: UnwrappedTileID): Float64Array {
        const decode = denormalizeECEF(tileBoundsOnGlobe(id.canonical));
        return mat4.multiply([], this._globeMatrix, decode);
    }

    createRenderTileMatrix(id: UnwrappedTileID): Float64Array {

    }

    createLabelPlaneMatrix(id: UnwrappedTileID): Float64Array {

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
        // if (numFacingAway === 4) {
        //     continue;
        // }

        // // Tile on globe facing away from the camera
        // if (it.zoom > 1) {
        //     const fwd = this._camera.forward();
        //     const [min, max] = tileLatLngCorners(id);

        //     const corners = [
        //         vec3.transformMat4([], latLngToECEF(min[0], min[1]), globeMatrix),
        //         vec3.transformMat4([], latLngToECEF(min[0], max[1]), globeMatrix),
        //         vec3.transformMat4([], latLngToECEF(max[0], min[1]), globeMatrix),
        //         vec3.transformMat4([], latLngToECEF(max[0], max[1]), globeMatrix)
        //     ];

        //     let numFacingAway = 0;

        //     for (let i = 0; i < corners.length; i++) {
        //         const p = corners[i];
        //         const dir = vec3.sub([], p, globeOrigo);

        //         if (vec3.dot(dir, fwd) >= 0) {
        //             numFacingAway++;
        //         }
        //     }

        //     if (numFacingAway === 4) {
        //         continue;
        //     }
        // }
    }
};

export default {
    name: 'globe',
    project(lng: number, lat: number) {
        return { x: 0, y: 0, z: 0 };
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

        const topEcefPerMeter = mercatorZfromAltitude(1, 0.0) * 2.0 * globeRefRadius * Math.PI;
        const bottomEcefPerMeter = mercatorZfromAltitude(1, 0.0) * 2.0 * globeRefRadius * Math.PI;
        //const pixelsPerMeter = mercatorZfromAltitude(1, 0.0) * (1 << tileID.canonical.z) * 512.0;

        if (!labelSpace) {
            vec3.scale(this._tlUp, vec3.normalize(this._tlUp, this._tlUp), topEcefPerMeter);
            vec3.scale(this._trUp, vec3.normalize(this._trUp, this._trUp), topEcefPerMeter);
            vec3.scale(this._brUp, vec3.normalize(this._brUp, this._brUp), bottomEcefPerMeter);
            vec3.scale(this._blUp, vec3.normalize(this._blUp, this._blUp), bottomEcefPerMeter);

            // Normalize
            const bounds = tileBoundsOnGlobe(tileID);

            const norm = mat4.identity(new Float64Array(16));
            const maxExtInv = 1.0 / Math.max(...vec3.sub([], bounds.max, bounds.min));
            const st = (1 << (normBitRange - 1)) - 1;

            mat4.scale(norm, norm, [st, st, st]);
            mat4.scale(norm, norm, [maxExtInv, maxExtInv, maxExtInv]);

            vec3.transformMat4(this._tlUp, this._tlUp, norm);
            vec3.transformMat4(this._trUp, this._trUp, norm);
            vec3.transformMat4(this._blUp, this._blUp, norm);
            vec3.transformMat4(this._brUp, this._brUp, norm);
        } else {
            //const pixelsPerMeter = mercatorZfromAltitude(1, 0.0) * (1 << tileID.canonical.z) * 512.0;
            const pixelsPerMeter = labelSpace;// mercatorZfromAltitude(1, 60.0) * labelSpace;

            this._tlUp = [0, 0, pixelsPerMeter];
            this._trUp = [0, 0, pixelsPerMeter];
            this._brUp = [0, 0, pixelsPerMeter];
            this._blUp = [0, 0, pixelsPerMeter];
        }
    }

    upVector(u: number, v: number): Array<number> {
        return vec3.lerp([],
            vec3.lerp([], this._tlUp, this._trUp, u),
            vec3.lerp([], this._blUp, this._brUp, u),
            v);
    }
}