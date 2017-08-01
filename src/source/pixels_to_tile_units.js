// @flow

const EXTENT = require('../data/extent');

import type TileCoord from './tile_coord';

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
module.exports = function(tile: {coord: TileCoord, tileSize: number}, pixelValue: number, z: number): number {
    return pixelValue * (EXTENT / (tile.tileSize * Math.pow(2, z - tile.coord.z)));
};
