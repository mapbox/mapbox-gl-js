// @flow
import albers from './albers.js';
import equalEarth from './equal_earth.js';
import equirectangular from './equirectangular.js';
import lambertConformalConic from './lambert.js';
import mercator from './mercator.js';
import naturalEarth from './natural_earth.js';
import winkelTripel from './winkel_tripel.js';
import cylindricalEqualArea from './cylindrical_equal_area.js';
import LngLat from '../lng_lat.js';
import type {ProjectionSpecification} from '../../style-spec/types.js';

export type Projection = {
    name: string,
    center: [number, number],
    parallels?: [number, number],
    range?: [number, number],
    conic?: boolean,
    wrap?: boolean,
    project: (lng: number, lat: number) => {x: number, y: number},
    unproject: (x: number, y: number) => LngLat
};

const projections = {
    albers,
    equalEarth,
    equirectangular,
    lambertConformalConic,
    mercator,
    naturalEarth,
    winkelTripel
};

function getConicProjection(projection: Projection, config: ProjectionSpecification) {
    if (config.parallels) {
        if (config.parallels[0] + config.parallels[1] === 0) {
            if (config.name === 'lambertConformalConic') return projections['mercator'];
            const center = config.center || projection.center;
            return {...projection, ...config, ...cylindricalEqualArea(center[1])};
        }
    }

    return {...projection, ...config};
}

export function getProjection(config: ProjectionSpecification) {
    const projection = projections[config.name];
    if (!projection) throw new Error(`Invalid projection name: ${config.name}`);
    return projection.conic ? getConicProjection(projection, config) : projection;
}
