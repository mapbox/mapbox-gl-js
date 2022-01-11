// @flow
import LngLat from '../lng_lat.js';
import {clamp} from '../../util/util.js';
import {mercatorZfromAltitude, MAX_MERCATOR_LATITUDE} from '../mercator_coordinate.js';
import type Transform from '../../geo/transform.js';
import Point from '@mapbox/point-geometry';
import FlatTileTransform from './flat_tile_transform.js';
import {farthestPixelDistanceOnPlane} from './far_z.js';

const a1 = 1.340264;
const a2 = -0.081106;
const a3 = 0.000893;
const a4 = 0.003796;
const M = Math.sqrt(3) / 2;

export default {
    name: 'equalEarth',
    center: [0, 0],
    range: [3.5, 7],
    zAxisUnit: "meters",
    isReprojectedInTileSpace: true,
    unsupportedLayers: ['custom'],

    project(lng: number, lat: number) {
        // based on https://github.com/d3/d3-geo, MIT-licensed
        lat = lat / 180 * Math.PI;
        lng = lng / 180 * Math.PI;
        const theta = Math.asin(M * Math.sin(lat));
        const theta2 = theta * theta;
        const theta6 = theta2 * theta2 * theta2;
        const x = lng * Math.cos(theta) / (M * (a1 + 3 * a2 * theta2 + theta6 * (7 * a3 + 9 * a4 * theta2)));
        const y = theta * (a1 + a2 * theta2 + theta6 * (a3 + a4 * theta2));

        return {
            x: (x / Math.PI + 0.5) * 0.5,
            y: 1 - (y / Math.PI + 1) * 0.5,
            z: 0
        };
    },

    unproject(x: number, y: number) {
        // based on https://github.com/d3/d3-geo, MIT-licensed
        x = (2 * x - 0.5) * Math.PI;
        y = (2 * (1 - y) - 1) * Math.PI;
        let theta = y;
        let theta2 = theta * theta;
        let theta6 = theta2 * theta2 * theta2;

        for (let i = 0, delta, fy, fpy; i < 12; ++i) {
            fy = theta * (a1 + a2 * theta2 + theta6 * (a3 + a4 * theta2)) - y;
            fpy = a1 + 3 * a2 * theta2 + theta6 * (7 * a3 + 9 * a4 * theta2);
            delta = fy / fpy;
            theta = clamp(theta - delta, -Math.PI / 3, Math.PI / 3);
            theta2 = theta * theta;
            theta6 = theta2 * theta2 * theta2;
            if (Math.abs(delta) < 1e-12) break;
        }

        const lambda = M * x * (a1 + 3 * a2 * theta2 + theta6 * (7 * a3 + 9 * a4 * theta2)) / Math.cos(theta);
        const phi = Math.asin(Math.sin(theta) / M);
        const lng = clamp(lambda * 180 / Math.PI, -180, 180);
        const lat = clamp(phi * 180 / Math.PI, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);

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
