// @flow

import {mat4, vec3} from 'gl-matrix';

import {Aabb} from '../../util/primitives.js';
import EXTENT from '../../data/extent.js';
import {degToRad} from '../../util/util.js';
import {lngFromMercatorX, latFromMercatorY, mercatorZfromAltitude} from '../mercator_coordinate.js';
import CanonicalTileID, { UnwrappedTileID } from '../../source/tile_id.js';

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

const normBitRange = 15;    // 8192

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
    tileID: UnwrappedTileID;
    _tlUp: Array<number>;
    _trUp: Array<number>;
    _blUp: Array<number>;
    _brUp: Array<number>;

    constructor(tileID: UnwrappedTileID, labelSpace = false) {
        this.tileID = tileID;

        // Pre-compute up vectors of each corner of the tile
        const corners = tileLatLngCorners(tileID.canonical);
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
            const bounds = tileBoundsOnGlobe(tileID.canonical);

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