// @flow
import albers from './albers.js';
import equalEarth from './equal_earth.js';
import equirectangular from './equirectangular.js';
import lambertConformalConic from './lambert.js';
import mercator from './mercator.js';
import naturalEarth from './natural_earth.js';
import winkelTripel from './winkel_tripel.js';
import cylindricalEqualArea from './cylindrical_equal_area.js';
import {extend} from '../../util/util.js';
import type {ProjectionSpecification} from '../../style-spec/types.js';
import globe from './globe.js';
import {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id.js';
import Transform from '../transform.js';
import LngLat from '../lng_lat.js';
import Point from '@mapbox/point-geometry';
import MercatorCoordinate from '../mercator_coordinate.js';
import type {Vec3} from 'gl-matrix';

export type Projection = {
    name: string,
    center: [number, number],
    parallels?: [number, number],
    range?: [number, number],
    conic?: boolean,
    wrap?: boolean,
    name: string,
    requiresDraping?: boolean,
    supportsTerrain?: boolean;
    supportsFog?: boolean;
    supportsFreeCamera?: boolean,
    supportsWorldCopies?: boolean,
    unsupportedLayers?: Array<string>,

    // Whether the projection reprojects data in tile space
    isReprojectedInTileSpace?: boolean;
    zAxisUnit: "meters" | "pixels",
    project: (lng: number, lat: number) => {x: number, y: number, z: number},
    unproject: (x: number, y: number) => LngLat,
    locationPoint: (tr: Transform, lngLat: LngLat) => Point,
    projectTilePoint: (x: number, y: number, id: CanonicalTileID) => {x: number, y: number, z: number},
    pixelsPerMeter: (lat: number, worldSize: number) => number,
    farthestPixelDistance: (tr: Transform) => number,
    upVector: (id: CanonicalTileID, x: number, y: number) => Vec3,
    upVectorScale: (id: CanonicalTileID, latitude: number, worldSize: number) => ElevationScale,
    createTileTransform: (tr: Transform, worldSize: number) => TileTransform,
};

const projections = {
    globe,
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
                cylindricalFunctions = {wrap: true, supportsWorldCopies: true, project, unproject};
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

export type ElevationScale = {
    // `metersToTile` converts meters to units used to describe elevation in tile space.
    // Default units in mercator space are x & y: [0, 8192] and z: meters
    metersToTile: number,

    // `metersToLabelSpace` converts meters to units used for elevation for map aligned
    // labels. Default unit in mercator space is meter.
    metersToLabelSpace: number
}

export type TileTransform = {
    createTileMatrix: (id: UnwrappedTileID) => Float64Array,
    createInversionMatrix: (id: CanonicalTileID) => Float32Array,
    pointCoordinate: (x: number, y: number, z?: number) => MercatorCoordinate
};
