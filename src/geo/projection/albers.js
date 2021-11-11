// @flow
import LngLat from '../lng_lat.js';
import {clamp, wrap, degToRad, radToDeg} from '../../util/util.js';
import {MAX_MERCATOR_LATITUDE} from '../mercator_coordinate.js';
import {vec2} from 'gl-matrix';
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
    name: 'albers',
    range: [4, 7],

    center: [-96, 37.5],
    parallels: [29.5, 45.5],

    conic: true,

    // based on https://github.com/d3/d3-geo-projection, MIT-licensed

    initializeConstants() {
        if (this.constants && vec2.exactEquals(this.parallels, this.constants.parallels)) {
            return;
        }

        const sy0 = Math.sin(degToRad(this.parallels[0]));
        const n = (sy0 + Math.sin(degToRad(this.parallels[1]))) / 2;
        const c = 1 + sy0 * (2 * n - sy0);
        const r0 = Math.sqrt(c) / n;

        this.constants = {n, c, r0, parallels: this.parallels};
    },

    project(lng: number, lat: number) {
        this.initializeConstants();

        const lambda = degToRad(lng - this.center[0]);
        const phi = degToRad(lat);

        const {n, c, r0} = this.constants;
        const r = Math.sqrt(c - 2 * n * Math.sin(phi)) / n;
        const x = r * Math.sin(lambda * n);
        const y = r * Math.cos(lambda * n) - r0;
        return {x, y};
    },

    unproject(x: number, y: number) {
        this.initializeConstants();
        const {n, c, r0} = this.constants;

        const r0y = r0 + y;
        let l = Math.atan2(x, Math.abs(r0y)) * Math.sign(r0y);
        if (r0y * n < 0) {
            l -= Math.PI * Math.sign(x) * Math.sign(r0y);
        }
        const dt = degToRad(this.center[0]) * n;
        l = wrap(l, -Math.PI - dt, Math.PI - dt);

        const lng = radToDeg(l / n) + this.center[0];
        const phi = Math.asin(clamp((c - (x * x + r0y * r0y) * n * n) / (2 * n), -1, 1));
        const lat = clamp(radToDeg(phi), -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);

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
