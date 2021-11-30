// @flow
import albers from './albers.js';
import equalEarth from './equal_earth.js';
import equirectangular from './equirectangular.js';
import lambertConformalConic from './lambert.js';
import mercator from './mercator.js';
import naturalEarth from './natural_earth.js';
import winkelTripel from './winkel_tripel.js';
import LngLat from '../lng_lat.js';
import type {ProjectionSpecification} from '../../style-spec/types.js';

export interface Projection {
    name: string,
    center: [number, number],
    parallels?: [number, number],
    range?: [number, number],
    wrap?: boolean,
    project: (lng: number, lat: number) => {x: number, y: number},
    unproject: (x: number, y: number) => LngLat
}

const projections = {
    albers,
    equalEarth,
    equirectangular,
    lambertConformalConic,
    mercator,
    naturalEarth,
    winkelTripel
};

export function getProjection(config: ProjectionSpecification): Projection {
    const createProjection = projections[config.name];
    if (!createProjection) throw new Error(`Invalid projection name: ${config.name}`);
    return createProjection(config);
}
