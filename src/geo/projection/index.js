// @flow
import {alaska, albers} from './albers.js';
import equalEarth from './equalEarth.js';
import equirectangular from './equirectangular.js';
import lambert from './lambert.js';
import mercator from './mercator.js';
import naturalEarth from './naturalEarth.js';
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
    alaska,
    albers,
    equalEarth,
    equirectangular,
    lambert,
    mercator,
    naturalEarth,
    winkel
};

export default function getProjection(config: {name: string} | string) {
    if (typeof config === 'string') {
        return projections[config];
    }
    return {...projections[config.name], ...config};
}
