'use strict';

const EXTENT = require('../data/extent');

/**
 * Converts a pixel value at a the given zoom level to tile units.
 *
 * The shaders mostly calculate everything in tile units so style
 * properties need to be converted from pixels to tile units using this.
 *
 * For example, a translation by 30 pixels at zoom 6.5 will be a
 * translation by pixelsToTileUnits(30, 6.5) tile units.
 *
 * @param {Object} tile a {Tile object} will work well, but any object that follows the format {coord: {TileCord object}, tileSize: {number}} will work
 * @param {number} pixelValue
 * @param {number} z
 * @returns {number} value in tile units
 * @private
 */
module.exports = function(tile, pixelValue, z) {
    return pixelValue * (EXTENT / (tile.tileSize * Math.pow(2, z - tile.coord.z)));
};
