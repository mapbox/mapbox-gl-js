// @flow
import LngLat from '../lng_lat.js';
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
import {farthestPixelDistanceOnPlane} from './far_z.js';

export default {
    name: 'mercator',
    wrap: true,
    requiresDraping: false,
    supportsWorldCopies: true,
    supportsTerrain: true,
    supportsFog: true,
    supportsFreeCamera: true,
    zAxisUnit: "meters",
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
        return farthestPixelDistanceOnPlane(tr, pixelsPerMeter);
    },

    createTileTransform(tr: Transform, worldSize: number): Object {
        return new FlatTileTransform(tr, worldSize);
    }
};
