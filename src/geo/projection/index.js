// @flow
import {alaska, albers} from './albers.js';
import equalEarth from './equalEarth.js';
import equirectangular from './equirectangular.js';
import lambertConicConformal from './lambert.js';
import mercator from './mercator.js';
import naturalEarth from './naturalEarth.js';
import winkelTripel from './winkelTripel.js';
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
    lambertConicConformal,
    mercator,
    naturalEarth,
    winkelTripel
};

export default function getProjection(config: {name: string} | string) {
    if (typeof config === 'string') {
        return projections[config];
    }
    return {...projections[config.name], ...config};
}
