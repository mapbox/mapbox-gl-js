// @flow
import {albers, alaska} from './albers.js';
import mercator from './mercator.js';
import wgs84 from './wgs84.js';
import winkel from './winkelTripel.js';
import LngLat from '../lng_lat.js';

export type Projection = {
    name: string,
    center: [number, number],
    range?: Array<number>,
    project: (lng: number, lat: number) => {x: number, y: number},
    unproject: (x: number, y: number) => LngLat
};

const projections = {
    albers,
    alaska,
    mercator,
    wgs84,
    winkel
};

export default function getProjection(config: {name: string} | string) {
    if (typeof config === 'string') {
        return projections[config];
    }
    return {...projections[config.name], ...config};
}
