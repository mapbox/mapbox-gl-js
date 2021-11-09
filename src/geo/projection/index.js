// @flow
import globe from './globe.js';
import mercator from './mercator.js';
import {mat4, vec3} from 'gl-matrix';
import {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id.js';
import {Aabb} from '../../util/primitives.js';
import Transform from '../transform.js';
import LngLat from '../lng_lat.js';
import Point from '@mapbox/point-geometry';
import MercatorCoordinate from '../mercator_coordinate.js';

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
