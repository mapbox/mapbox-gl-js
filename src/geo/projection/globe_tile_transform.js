// @flow
import type Transform from '../transform.js';
import {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id.js';
import {mat4, vec4, vec3} from 'gl-matrix';
import MercatorCoordinate, {lngFromMercatorX, latFromMercatorY, mercatorZfromAltitude, mercatorXfromLng, mercatorYfromLat} from '../mercator_coordinate.js';
import EXTENT from '../../data/extent.js';
import {degToRad, radToDeg, getColumn} from '../../util/util.js';
import {Ray} from '../../util/primitives.js';
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
        const tiles = 1 << id.z;
        const mercX = (x / EXTENT + id.x) / tiles;
        const mercY = (y / EXTENT + id.y) / tiles;
        return latLngToECEF(latFromMercatorY(mercY), lngFromMercatorX(mercX), 1.0);
    }

    upVectorScale(id: CanonicalTileID): number {
        const pixelsPerMeterECEF = mercatorZfromAltitude(1, 0.0) * 2.0 * GLOBE_RADIUS * Math.PI;
        return pixelsPerMeterECEF * globeECEFNormalizationScale(globeTileBounds(id));
    }

    pointCoordinate(x: number, y: number): MercatorCoordinate {
        const point0 = [x, y, 0, 1];
        const point1 = [x, y, 1, 1];

        vec4.transformMat4(point0, point0, this._tr.pixelMatrixInverse);
        vec4.transformMat4(point1, point1, this._tr.pixelMatrixInverse);

        vec4.scale(point0, point0, 1 / point0[3]);
        vec4.scale(point1, point1, 1 / point1[3]);

        const p0p1 = vec3.sub([], point1, point0);
        const direction = vec3.normalize([], p0p1);

        // Compute globe origo in world space
        const globeCenter = vec3.transformMat4([], [0, 0, 0], this._globeMatrix);
        const radius = this._worldSize / (2.0 * Math.PI);

        const pointOnGlobe = [];
        const ray = new Ray(point0, direction);

        ray.closestPointOnSphere(globeCenter, radius, pointOnGlobe);

        // Transform coordinate axes to find lat & lng of the position
        const xa = vec3.normalize([], getColumn(this._globeMatrix, 0));
        const ya = vec3.normalize([], getColumn(this._globeMatrix, 1));
        const za = vec3.normalize([], getColumn(this._globeMatrix, 2));

        const xp = vec3.dot(xa, pointOnGlobe);
        const yp = vec3.dot(ya, pointOnGlobe);
        const zp = vec3.dot(za, pointOnGlobe);

        const lat = radToDeg(Math.asin(-yp / radius));
        const lng = radToDeg(Math.atan2(xp, zp));

        const mx = mercatorXfromLng(lng);
        const my = mercatorYfromLat(lat);

        return new MercatorCoordinate(mx, my);
    }
}
