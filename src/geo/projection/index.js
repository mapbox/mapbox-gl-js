// @flow
import LngLat from '../lng_lat.js';
import globe from './globe.js';
import mercator from './mercator.js';
import { OverscaledTileID, CanonicalTileID } from '../../source/tile_id.js';
import { Aabb } from '../../util/primitives.js';
import Transform from '../transform.js';
import { FreeCamera } from '../../ui/free_camera.js';



// 2D: tileMatrix = projMatrix * posMatrix
// Globe: tileMatrix = projMatrix * globeMatrix * decode

// tileMatrix: calculatePosMatrix
// tileRenderMatrix: calulcatePosMatrix with possible decode

export type TileTransform = {

    createLabelPlaneMatrix: (posMatrix: mat4, tileID: CanonicalTileID, pitchWithMap: boolean, rotateWithMap: boolean, pixelsToTileUnits) => mat4,

    createGlCoordMatrix: (posMatrix: mat4, tileID: CanonicalTileID, pitchWithMap: boolean, rotateWithMap: boolean, pixelsToTileUnits) => mat4,

    createTileMatrix: (id: UnwrappedTileID) => Float64Array,

    tileAabb: (id: UnwrappedTileID, z: number, min: number, max: number) => Aabb,

    upVector: (id: CanonicalTileID, x: Number, y: number) => vec3,
};

export type Projection = {
    name: string,
    project: (lng: number, lat: number) => {x: number, y: number, z: number},
    //unproject: (x: number, y: number) => LngLat

    projectTilePoint: (x: number, y: number, id: CanonicalTileID) => {x:number, y: number, z:number},

    requiresDraping: boolean,
    supportsWorldCopies: boolean,
    supportsWorldCopies: boolean,
    zAxisUnit: "meters" | "pixels",

    pixelsPerMeter: (lat: number, worldSize: number) => Number,

    createTileTransform: (tr: Transform, worldSize: number) => TileTransform,

    cullTile: (aabb: Aabb, id: CanonicalTileID, camera: FreeCamera) => boolean,
};

const projections = {
    globe,
    mercator
};

export default function getProjection(name: ?string) {
    if (!name || !(name in projections))
        return projections.mercator;
    return projections[name];
}