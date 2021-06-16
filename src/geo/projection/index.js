// @flow
import {albers, alaska} from './albers.js';
import mercator from './mercator.js';
import sinusoidal from './sinusoidal.js';
import wgs84 from './wgs84.js';
import winkel from './winkelTripel.js';
import LngLat from '../lng_lat.js';

export type Projection = {
    name: string,
    range: Array<number>,
    project: (lng: number, lat: number, options?: Object) => {x: number, y: number},
    unproject: (x: number, y: number) => LngLat
};

export default {
    albers,
    alaska,
    mercator,
    sinusoidal,
    wgs84,
    winkel
};
