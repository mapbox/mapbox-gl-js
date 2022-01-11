// @flow
import LngLat from '../lng_lat.js';
import {clamp} from '../../util/util.js';
import {mercatorZfromAltitude, MAX_MERCATOR_LATITUDE} from '../mercator_coordinate.js';
import type Transform from '../../geo/transform.js';
import Point from '@mapbox/point-geometry';
import FlatTileTransform from './flat_tile_transform.js';
import {farthestPixelDistanceOnPlane} from './far_z.js';

export default {
    name: 'equirectangular',
    supportsWorldCopies: true,
    center: [0, 0],
    range: [3.5, 7],
    zAxisUnit: "meters",
    wrap: true,
    isReprojectedInTileSpace: true,
    unsupportedLayers: ['custom'],

    project(lng: number, lat: number) {
        const x = 0.5 + lng / 360;
        const y = 0.5 - lat / 360;
        return {x, y, z: 0};
    },

    unproject(x: number, y: number) {
        const lng = (x - 0.5) * 360;
        const lat = clamp((0.5 - y) * 360, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
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
        return farthestPixelDistanceOnPlane(tr, pixelsPerMeter);
    },

    createTileTransform(tr: Transform, worldSize: number): Object {
        return new FlatTileTransform(tr, worldSize);
    }
};
