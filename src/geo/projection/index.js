// @flow
import {alaska, albers} from './albers.js';
import equalEarth from './equalEarth.js';
import equirectangular from './equirectangular.js';
import lambertConformalConic from './lambert.js';
import mercator from './mercator.js';
import naturalEarth from './naturalEarth.js';
import winkelTripel from './winkelTripel.js';
import LngLat from '../lng_lat.js';

export type Projection = {
    name: string,
    center: Array<number>,
    parallels?: Array<number>,
    range?: Array<number>,
    project: (lng: number, lat: number) => {x: number, y: number},
    unproject: (x: number, y: number) => LngLat
};

export type ProjectionOptions = {
    name: string,
    center?: Array<number>, 
    parallels?: Array<number>
};

const projections = {
    alaska,
    albers,
    equalEarth,
    equirectangular,
    lambertConformalConic,
    mercator,
    naturalEarth,
    winkelTripel
};

export default function getProjection(config: ProjectionOptions) {
    return {...projections[config.name], ...config};
}
