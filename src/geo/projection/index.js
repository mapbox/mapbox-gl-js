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
import {extend} from '../../util/util.js';
import type {ProjectionSpecification} from '../../style-spec/types.js';
import globe from './globe.js';
import mercator from './mercator.js';
import {mat4, vec3} from 'gl-matrix';
import {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id.js';
import {Aabb} from '../../util/primitives.js';
import Transform from '../transform.js';
import LngLat from '../lng_lat.js';
import Point from '@mapbox/point-geometry';
import MercatorCoordinate from '../mercator_coordinate.js';

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
        // parallels that are equal but with opposite signs (e.g. [10, -10])
        // create a cylindrical projection so we replace the
        // project and unproject functions with equivalent cylindrical versions
        if (Math.abs(config.parallels[0] + config.parallels[1]) < 0.01) {
            let cylindricalFunctions = cylindricalEqualArea((config: any).parallels[0]);

            if (config.name === 'lambertConformalConic') {
                const {project, unproject} = projections['mercator'];
                cylindricalFunctions = {wrap: true, project, unproject};
            }

            return extend({}, projection, config, cylindricalFunctions);
        }
    }

    return extend({}, projection, config);
}

export function getProjection(config: ProjectionSpecification) {
    const projection = projections[config.name];
    if (!projection) throw new Error(`Invalid projection name: ${config.name}`);
    return projection.conic ? getConicProjection(projection, config) : projection;
}

export type TileTransform = {
    createLabelPlaneMatrix: (posMatrix: mat4, tileID: CanonicalTileID, pitchWithMap: boolean, rotateWithMap: boolean, pixelsToTileUnits: number) => mat4,

    createGlCoordMatrix: (posMatrix: mat4, tileID: CanonicalTileID, pitchWithMap: boolean, rotateWithMap: boolean, pixelsToTileUnits: number) => mat4,

    createTileMatrix: (id: UnwrappedTileID) => mat4,

    createInversionMatrix: (id: UnwrappedTileID) => mat4,

    tileAabb: (id: UnwrappedTileID, z: number, min: number, max: number) => Aabb,

    upVector: (id: CanonicalTileID, x: number, y: number) => vec3,

    upVectorScale: (id: CanonicalTileID) => number,

    pointCoordinate: (x: number, y: number, z?: number) => MercatorCoordinate
};

export type Projection = {
    name: string,
    requiresDraping: boolean,
    supportsWorldCopies: boolean,
    zAxisUnit: "meters" | "pixels",

    project: (lng: number, lat: number) => {x: number, y: number, z: number},

    locationPoint: (tr: Transform, lngLat: LngLat) => Point,

    projectTilePoint: (x: number, y: number, id: CanonicalTileID) => {x: number, y: number, z: number},

    pixelsPerMeter: (lat: number, worldSize: number) => number,

    farthestPixelDistance: (tr: Transform) => number,

    createTileTransform: (tr: Transform, worldSize: number) => TileTransform,
};

const projections = {
    globe,
    mercator
};

export default function getProjection(name: ?string): Projection {
    if (!name || !(name in projections))
        return projections.mercator;
    return projections[name];
}
