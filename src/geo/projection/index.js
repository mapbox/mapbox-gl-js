// @flow
import {alaska, albers} from './albers.js';
import equalEarth from './equalEarth.js';
import equirectangular from './equirectangular.js';
import lambertConformalConic from './lambert.js';
import mercator from './mercator.js';
import naturalEarth from './naturalEarth.js';
import winkelTripel from './winkelTripel.js';
import LngLat from '../lng_lat.js';
import type {ProjectionSpecification} from '../../style-spec/types.js';

export type Projection = {
    name: string,
    center: [number, number],
    parallels?: [number, number],
    range?: [number, number],
    conical?: boolean,
    project: (lng: number, lat: number) => {x: number, y: number},
    unproject: (x: number, y: number) => LngLat
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

export function getProjection(config: ProjectionSpecification) {
    const projection = projections[config.name];
    if (!projection) throw new Error(`Invalid projection name: ${config.name}`);
    return projection.conical ? {...projection, ...config} : projection;
}
