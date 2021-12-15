// @flow
import type Transform from '../transform.js';
import {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id.js';
import {mat4, vec4, vec3} from 'gl-matrix';
import MercatorCoordinate, {mercatorZfromAltitude, mercatorXfromLng, mercatorYfromLat} from '../mercator_coordinate.js';
import EXTENT from '../../data/extent.js';
import {degToRad, clamp} from '../../util/util.js';
import {
    latLngToECEF,
    globeTileBounds,
    globeECEFNormalizationScale,
    globeECEFUnitsToPixelScale,
    calculateGlobeMatrix,
    globeNormalizeECEF,
    globeDenormalizeECEF,
    GLOBE_RADIUS,
} from './globe.js';

export default class GlobeTileTransform {
    _tr: Transform;
    _worldSize: number;
    _globeMatrix: Float64Array;

    constructor(tr: Transform, worldSize: number) {
        this._tr = tr;
        this._worldSize = worldSize;
        this._globeMatrix = calculateGlobeMatrix(tr, worldSize);
    }

    createTileMatrix(id: UnwrappedTileID): mat4 {
        const decode = globeDenormalizeECEF(globeTileBounds(id.canonical));
        return mat4.multiply([], this._globeMatrix, decode);
    }

    createInversionMatrix(id: UnwrappedTileID): mat4 {
        const identity = mat4.identity(new Float64Array(16));

        const center = this._tr.center;
        const ecefUnitsToPixels = globeECEFUnitsToPixelScale(this._worldSize);
        const matrix = mat4.identity(new Float64Array(16));
        const encode = globeNormalizeECEF(globeTileBounds(id.canonical));
        mat4.multiply(matrix, matrix, encode);
        mat4.rotateY(matrix, matrix, degToRad(center.lng));
        mat4.rotateX(matrix, matrix, degToRad(center.lat));

        mat4.scale(matrix, matrix, [1.0 / ecefUnitsToPixels, 1.0 / ecefUnitsToPixels, 1.0]);

        const PPMMercator = mercatorZfromAltitude(1.0, center.lat) * this._worldSize;
        const globeToMercatorPPMRatio = PPMMercator / this._tr.pixelsPerMeter;
        const worldSizeMercator = this._worldSize / globeToMercatorPPMRatio;
        const wsRadius = worldSizeMercator / (2.0 * Math.PI);
        const localRadius = EXTENT / (2.0 * Math.PI);
        const ecefUnitsToMercatorPixels = wsRadius / localRadius;

        mat4.scale(identity, identity, [ecefUnitsToMercatorPixels, ecefUnitsToMercatorPixels, 1.0]);

        return mat4.multiply(matrix, matrix, identity);
    }

    upVector(id: CanonicalTileID, x: number, y: number): vec3 {
        const corners = globeTileLatLngCorners(id);
        const tl = corners[0];
        const br = corners[1];

        const tlUp = latLngToECEF(tl[0], tl[1]);
        const trUp = latLngToECEF(tl[0], br[1]);
        const brUp = latLngToECEF(br[0], br[1]);
        const blUp = latLngToECEF(br[0], tl[1]);

        vec3.normalize(tlUp, tlUp);
        vec3.normalize(trUp, trUp);
        vec3.normalize(brUp, brUp);
        vec3.normalize(blUp, blUp);

        const u = x / EXTENT;
        const v = y / EXTENT;

        const tltr = vec3.lerp([], tlUp, trUp, u);
        const blbr = vec3.lerp([], blUp, brUp, u);

        return vec3.lerp([], tltr, blbr, v);
    }

    upVectorScale(id: CanonicalTileID): number {
        const pixelsPerMeterECEF = mercatorZfromAltitude(1, 0.0) * 2.0 * GLOBE_RADIUS * Math.PI;
        return pixelsPerMeterECEF * globeECEFNormalizationScale(globeTileBounds(id));
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
        const matrix = calculateGlobeMatrix(this._tr, this._worldSize);
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
}
