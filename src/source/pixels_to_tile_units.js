// @flow

import {mat2} from 'gl-matrix';

import EXTENT from '../data/extent.js';

import type {OverscaledTileID} from './tile_id.js';
import type Transform from '../geo/transform.js';
import type {TileTransform} from '../geo/projection/tile_transform.js';

/**
 * Converts a pixel value at a the given zoom level to tile units.
 *
 * The shaders mostly calculate everything in tile units so style
 * properties need to be converted from pixels to tile units using this.
 *
 * For example, a translation by 30 pixels at zoom 6.5 will be a
 * translation by pixelsToTileUnits(30, 6.5) tile units.
 *
 * @returns value in tile units
 * @private
 */
export default function(tile: interface {tileID: OverscaledTileID, tileSize: number}, pixelValue: number, z: number): number {
    return pixelValue * (EXTENT / (tile.tileSize * Math.pow(2, z - tile.tileID.overscaledZ)));
}

export function getPixelsToTileUnitsMatrix(tile: interface {tileID: OverscaledTileID, tileSize: number, +tileTransform: TileTransform}, transform: Transform): Float32Array {
    const {scale} = tile.tileTransform;
    const s = scale * EXTENT / (tile.tileSize * Math.pow(2, transform.zoom - tile.tileID.overscaledZ + tile.tileID.canonical.z));
    return mat2.scale(new Float32Array(4), transform.inverseAdjustmentMatrix, [s, s]);
}
