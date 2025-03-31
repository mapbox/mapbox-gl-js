import {mat4, vec3} from 'gl-matrix';
import EXTENT from '../../style-spec/data/extent';
import {latLngToECEF} from '../lng_lat';
import {degToRad} from '../../util/util';
import MercatorCoordinate, {
    mercatorZfromAltitude,
} from '../mercator_coordinate';
import Mercator from './mercator';
import Point from '@mapbox/point-geometry';
import {farthestPixelDistanceOnPlane, farthestPixelDistanceOnSphere} from './far_z';
import {number as interpolate} from '../../style-spec/util/interpolate';
import {
    globeTileBounds,
    globeNormalizeECEF,
    globeDenormalizeECEF,
    globeECEFNormalizationScale,
    globeToMercatorTransition,
    globePointCoordinate,
    tileCoordToECEF,
    globeMetersToEcef
} from './globe_util';
import {GLOBE_SCALE_MATCH_LATITUDE} from './globe_constants';

import type LngLat from '../lng_lat';
import type Transform from '../transform';
import type {ElevationScale} from './projection';
import type {ProjectionSpecification} from '../../style-spec/types';
import type {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id';

export default class Globe extends Mercator {

    constructor(options: ProjectionSpecification) {
        super(options);
        this.requiresDraping = true;
        this.supportsWorldCopies = false;
        this.supportsFog = true;
        this.zAxisUnit = "pixels";
        this.unsupportedLayers = ['debug'];
        this.range = [3, 5];
    }

    override projectTilePoint(x: number, y: number, id: CanonicalTileID): {
        x: number;
        y: number;
        z: number;
    } {
        const pos = tileCoordToECEF(x, y, id);
        const bounds = globeTileBounds(id);
        const normalizationMatrix = globeNormalizeECEF(bounds);
        vec3.transformMat4(pos, pos, normalizationMatrix);

        return {x: pos[0], y: pos[1], z: pos[2]};
    }

    override locationPoint(tr: Transform, lngLat: LngLat, altitude?: number): Point {
        const pos = latLngToECEF(lngLat.lat, lngLat.lng);
        const up = vec3.normalize([] as unknown as vec3, pos);

        const elevation = altitude ?
            tr._centerAltitude + altitude :
            tr.elevation ?
                tr.elevation.getAtPointOrZero(tr.locationCoordinate(lngLat), tr._centerAltitude) :
                tr._centerAltitude;

        const upScale = mercatorZfromAltitude(1, 0) * EXTENT * elevation;
        vec3.scaleAndAdd(pos, pos, up, upScale);
        const matrix = mat4.identity(new Float64Array(16) as unknown as mat4);
        mat4.multiply(matrix, tr.pixelMatrix, tr.globeMatrix);
        vec3.transformMat4(pos, pos, matrix);

        return new Point(pos[0], pos[1]);
    }

    override pixelsPerMeter(lat: number, worldSize: number): number {
        return mercatorZfromAltitude(1, 0) * worldSize;
    }

    override pixelSpaceConversion(lat: number, worldSize: number, interpolationT: number): number {
        // Using only the center latitude to determine scale causes the globe to rapidly change
        // size as you pan up and down. As you approach the pole, the globe's size approaches infinity.
        // This is because zoom levels are based on mercator.
        //
        // Instead, use a fixed reference latitude at lower zoom levels. And transition between
        // this latitude and the center's latitude as you zoom in. This is a compromise that
        // makes globe view more usable with existing camera parameters, styles and data.
        const centerScale = mercatorZfromAltitude(1, lat) * worldSize;
        const referenceScale = mercatorZfromAltitude(1, GLOBE_SCALE_MATCH_LATITUDE) * worldSize;
        const combinedScale = interpolate(referenceScale, centerScale, interpolationT);
        return this.pixelsPerMeter(lat, worldSize) / combinedScale;
    }

    override createTileMatrix(tr: Transform, worldSize: number, id: UnwrappedTileID): mat4 {
        const decode = globeDenormalizeECEF(globeTileBounds(id.canonical));
        return mat4.multiply(new Float64Array(16) as unknown as mat4, tr.globeMatrix, decode);
    }

    override createInversionMatrix(tr: Transform, id: CanonicalTileID): Float32Array {
        const {center} = tr;
        const matrix = globeNormalizeECEF(globeTileBounds(id));
        mat4.rotateY(matrix, matrix, degToRad(center.lng));
        mat4.rotateX(matrix, matrix, degToRad(center.lat));
        mat4.scale(matrix, matrix, [tr._pixelsPerMercatorPixel, tr._pixelsPerMercatorPixel, 1.0]);
        return Float32Array.from(matrix);
    }

    override pointCoordinate(tr: Transform, x: number, y: number, _: number): MercatorCoordinate {
        const coord = globePointCoordinate(tr, x, y, true);
        if (!coord) { return new MercatorCoordinate(0, 0); } // This won't happen, is here for Flow
        return coord;
    }

    override pointCoordinate3D(tr: Transform, x: number, y: number): vec3 | null | undefined {
        const coord = this.pointCoordinate(tr, x, y, 0);
        return [coord.x, coord.y, coord.z];
    }

    override isPointAboveHorizon(tr: Transform, p: Point): boolean {
        const raycastOnGlobe = globePointCoordinate(tr, p.x, p.y, false);
        return !raycastOnGlobe;
    }

    override farthestPixelDistance(tr: Transform): number {
        const pixelsPerMeter = this.pixelsPerMeter(tr.center.lat, tr.worldSize);
        const globePixelDistance = farthestPixelDistanceOnSphere(tr, pixelsPerMeter);
        const t = globeToMercatorTransition(tr.zoom);
        if (t > 0.0) {
            const mercatorPixelsPerMeter = mercatorZfromAltitude(1, tr.center.lat) * tr.worldSize;
            const mercatorPixelDistance = farthestPixelDistanceOnPlane(tr, mercatorPixelsPerMeter);
            const pixelRadius = tr.worldSize / (2.0 * Math.PI);
            const approxTileArcHalfAngle = Math.max(tr.width, tr.height) / tr.worldSize * Math.PI;
            const padding = pixelRadius * (1.0 - Math.cos(approxTileArcHalfAngle));

            // During transition to mercator we would like to keep
            // the far plane lower to ensure that geometries (e.g. circles) that are far away and are not supposed
            // to be rendered get culled out correctly. see https://github.com/mapbox/mapbox-gl-js/issues/11476
            // To achieve this we dampen the interpolation.
            return interpolate(globePixelDistance, mercatorPixelDistance + padding, Math.pow(t, 10.0));
        }
        return globePixelDistance;
    }

    override upVector(id: CanonicalTileID, x: number, y: number): [number, number, number] {
        return tileCoordToECEF(x, y, id, 1);
    }

    override upVectorScale(id: CanonicalTileID): ElevationScale {
        return {metersToTile: globeMetersToEcef(globeECEFNormalizationScale(globeTileBounds(id)))};
    }
}
