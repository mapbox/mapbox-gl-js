// @flow
import assert from 'assert';
import {mat4, vec3} from 'gl-matrix';
import {clamp} from '../../util/util.js';
import LngLat from '../lng_lat.js';
import MercatorCoordinate, {mercatorXfromLng, mercatorYfromLat, mercatorZfromAltitude} from '../mercator_coordinate.js';
import EXTENT from '../../data/extent.js';
import type Transform from '../../geo/transform.js';
import {Aabb} from '../../util/primitives.js';
import {UnwrappedTileID, CanonicalTileID} from '../../source/tile_id.js';
import Point from '@mapbox/point-geometry';

class MercatorTileTransform {
    _tr: Transform;
    _worldSize: number;
    _identity: Float64Array;

    constructor(tr: Transform, worldSize: number) {
        this._tr = tr;
        this._worldSize = worldSize;
        // eslint-disable-next-line no-warning-comments
        // TODO: Cache this elsewhere?
        this._identity = mat4.identity(new Float64Array(16));
    }

    createLabelPlaneMatrix(posMatrix: mat4, tileID: CanonicalTileID, pitchWithMap: boolean, rotateWithMap: boolean, pixelsToTileUnits): mat4 {
        const m = mat4.create();
        if (pitchWithMap) {
            mat4.scale(m, m, [1 / pixelsToTileUnits, 1 / pixelsToTileUnits, 1]);
            if (!rotateWithMap) {
                mat4.rotateZ(m, m, this._tr.angle);
            }
        } else {
            mat4.multiply(m, this._tr.labelPlaneMatrix, posMatrix);
        }
        return m;
    }

    createGlCoordMatrix(posMatrix: mat4, tileID: CanonicalTileID, pitchWithMap: boolean, rotateWithMap: boolean, pixelsToTileUnits): mat4 {
        if (pitchWithMap) {
            const m = mat4.clone(posMatrix);
            mat4.scale(m, m, [pixelsToTileUnits, pixelsToTileUnits, 1]);
            if (!rotateWithMap) {
                mat4.rotateZ(m, m, -this._tr.angle);
            }
            return m;
        } else {
            return this._tr.glCoordMatrix;
        }
    }

    createInversionMatrix(): mat4 {
        return this._identity;
    }

    createTileMatrix(id: UnwrappedTileID): mat4 {
        const canonical = id.canonical;
        const zoomScale = Math.pow(2, canonical.z);
        const scale = this._worldSize / zoomScale;
        const unwrappedX = canonical.x + zoomScale * id.wrap;

        const posMatrix = mat4.identity(new Float64Array(16));
        mat4.translate(posMatrix, posMatrix, [unwrappedX * scale, canonical.y * scale, 0]);
        mat4.scale(posMatrix, posMatrix, [scale / EXTENT, scale / EXTENT, 1]);

        return posMatrix;
    }

    tileAabb(id: UnwrappedTileID, z: number, min: number, max: number) {
        assert(z >= id.canonical.z);
        const numTiles = 1 << z;
        const zScale = 1 << (z - id.canonical.z);
        const wrap = id.wrap;

        const xMin = wrap * numTiles + id.canonical.x * zScale;
        const xMax = wrap * numTiles + (id.canonical.x + 1) * zScale;
        const yMin = id.canonical.y * zScale;
        const yMax = (id.canonical.y + 1) * zScale;

        return new Aabb(
            [xMin, yMin, min],
            [xMax, yMax, max]);
    }

    pointCoordinate(x: number, y: number, z?: number): MercatorCoordinate {
        const horizonOffset = this._tr.horizonLineFromTop(false);
        const clamped = new Point(x, Math.max(horizonOffset, y));
        return this._tr.rayIntersectionCoordinate(this._tr.pointRayIntersection(clamped, z));
    }

    upVector(): vec3 {
        return [0, 0, 1];
    }

    upVectorScale(): number {
        return 1;
    }
}

export default {
    name: 'mercator',
    requiresDraping: false,
    supportsWorldCopies: true,
    zAxisUnit: "meters",

    project(lng: number, lat: number) {
        const x = mercatorXfromLng(lng);
        const y = mercatorYfromLat(lat);
        return {x, y, z: 0};
    },

    projectTilePoint(x: number, y: number): {x: number, y: number, z: number} {
        return {x, y, z: 0};
    },

    locationPoint(tr: Transform, lngLat: LngLat): Point {
        return tr._coordinatePoint(tr.locationCoordinate(lngLat), false);
    },

    pixelsPerMeter(lat: number, worldSize: number) {
        return mercatorZfromAltitude(1, lat) * worldSize;
    },

    farthestPixelDistance(tr: Transform): number {
        const pixelsPerMeter = this.pixelsPerMeter(tr.center.lat, tr.worldSize);

        // Find the distance from the center point [width/2 + offset.x, height/2 + offset.y] to the
        // center top point [width/2 + offset.x, 0] in Z units, using the law of sines.
        // 1 Z unit is equivalent to 1 horizontal px at the center of the map
        // (the distance between[width/2, height/2] and [width/2 + 1, height/2])
        const groundAngle = Math.PI / 2 + tr._pitch;
        const fovAboveCenter = tr.fovAboveCenter;

        // Adjust distance to MSL by the minimum possible elevation visible on screen,
        // this way the far plane is pushed further in the case of negative elevation.
        const minElevationInPixels = tr.elevation ?
            tr.elevation.getMinElevationBelowMSL() * pixelsPerMeter :
            0;
        const cameraToSeaLevelDistance = ((tr._camera.position[2] * tr.worldSize) - minElevationInPixels) / Math.cos(tr._pitch);
        const topHalfSurfaceDistance = Math.sin(fovAboveCenter) * cameraToSeaLevelDistance / Math.sin(clamp(Math.PI - groundAngle - fovAboveCenter, 0.01, Math.PI - 0.01));

        // Calculate z distance of the farthest fragment that should be rendered.
        const furthestDistance = Math.cos(Math.PI / 2 - tr._pitch) * topHalfSurfaceDistance + cameraToSeaLevelDistance;
        const horizonDistance = cameraToSeaLevelDistance * (1 / tr._horizonShift);

        // Add a bit extra to avoid precision problems when a fragment's distance is exactly `furthestDistance`
        return Math.min(furthestDistance * 1.01, horizonDistance);
    },

    createTileTransform(tr: Transform, worldSize: number): Object {
        return new MercatorTileTransform(tr, worldSize);
    },
};
