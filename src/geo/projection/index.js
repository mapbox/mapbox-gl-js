// @flow
import globe from './globe.js';
import mercator from './mercator.js';
import {mat4, vec3} from 'gl-matrix';
import {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id.js';
import {Aabb} from '../../util/primitives.js';
import Transform from '../transform.js';
import {FreeCamera} from '../../ui/free_camera.js';
import MercatorCoordinate from '../mercator_coordinate.js';

export type TileTransform = {
    createLabelPlaneMatrix: (posMatrix: mat4, tileID: CanonicalTileID, pitchWithMap: boolean, rotateWithMap: boolean, pixelsToTileUnits: number) => mat4,

    createGlCoordMatrix: (posMatrix: mat4, tileID: CanonicalTileID, pitchWithMap: boolean, rotateWithMap: boolean, pixelsToTileUnits: number) => mat4,

    createTileMatrix: (id: UnwrappedTileID) => Float32Array,

    createInversionMatrix: (id: UnwrappedTileID) => Float32Array,

    tileAabb: (id: UnwrappedTileID, z: number, min: number, max: number) => Aabb,

    upVector: (id: CanonicalTileID, x: number, y: number) => vec3,

    upVectorScale: (id: CanonicalTileID) => number,

    pointCoordinate: (x: number, y: number, z?: number) => MercatorCoordinate,

    tileSpaceUpVectorScale: () => number,

    cullTile: (aabb: Aabb, id: CanonicalTileID, zoom: number, camera: FreeCamera) => boolean
};

export type Projection = {
    name: string,
    project: (lng: number, lat: number) => {x: number, y: number, z: number},

    projectTilePoint: (x: number, y: number, id: CanonicalTileID) => {x: number, y: number, z: number},

    requiresDraping: boolean,
    supportsWorldCopies: boolean,
    zAxisUnit: "meters" | "pixels",

    pixelsPerMeter: (lat: number, worldSize: number) => number,

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
