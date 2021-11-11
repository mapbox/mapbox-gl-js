// @flow
import LngLat from '../lng_lat.js';
import {clamp} from '../../util/util.js';
import {
    mercatorXfromLng,
    mercatorYfromLat,
    mercatorZfromAltitude,
    lngFromMercatorX,
    latFromMercatorY
} from '../mercator_coordinate.js';
import type Transform from '../../geo/transform.js';
import Point from '@mapbox/point-geometry';
import FlatTileTransform from './flat_tile_transform.js';

export default {
    name: 'mercator',
    requiresDraping: false,
    supportsWorldCopies: true,
    zAxisUnit: "meters",
    wrap: true,
    center: [0, 0],

    project(lng: number, lat: number) {
        const x = mercatorXfromLng(lng);
        const y = mercatorYfromLat(lat);
        return {x, y, z: 0};
    },

    unproject(x: number, y: number) {
        const lng = lngFromMercatorX(x);
        const lat = latFromMercatorY(y);
        return new LngLat(lng, lat);
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
        return new FlatTileTransform(tr, worldSize);
    }
};
