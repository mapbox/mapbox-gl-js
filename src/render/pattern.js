// @flow

const assert = require('assert');
const pixelsToTileUnits = require('../source/pixels_to_tile_units');

import type Painter from './painter';
import type Program from './program';
import type TileCoord from '../source/tile_coord';

type CrossFaded<T> = {
    from: T,
    to: T,
    fromScale: number,
    toScale: number,
    t: number
};

/**
 * Checks whether a pattern image is needed, and if it is, whether it is not loaded.
 *
 * @returns true if a needed image is missing and rendering needs to be skipped.
 */
exports.isPatternMissing = function(image: CrossFaded<string>, painter: Painter): boolean {
    if (!image) return false;
    const imagePosA = painter.imageManager.getPattern(image.from);
    const imagePosB = painter.imageManager.getPattern(image.to);
    return !imagePosA || !imagePosB;
};

exports.prepare = function (image: CrossFaded<string>, painter: Painter, program: Program) {
    const gl = painter.gl;

    const imagePosA = painter.imageManager.getPattern(image.from);
    const imagePosB = painter.imageManager.getPattern(image.to);
    assert(imagePosA && imagePosB);

    gl.uniform1i(program.uniforms.u_image, 0);
    gl.uniform2fv(program.uniforms.u_pattern_tl_a, (imagePosA: any).tl);
    gl.uniform2fv(program.uniforms.u_pattern_br_a, (imagePosA: any).br);
    gl.uniform2fv(program.uniforms.u_pattern_tl_b, (imagePosB: any).tl);
    gl.uniform2fv(program.uniforms.u_pattern_br_b, (imagePosB: any).br);
    const {width, height} = painter.imageManager.getPixelSize();
    gl.uniform2fv(program.uniforms.u_texsize, [width, height]);
    gl.uniform1f(program.uniforms.u_mix, image.t);
    gl.uniform2fv(program.uniforms.u_pattern_size_a, (imagePosA: any).displaySize);
    gl.uniform2fv(program.uniforms.u_pattern_size_b, (imagePosB: any).displaySize);
    gl.uniform1f(program.uniforms.u_scale_a, image.fromScale);
    gl.uniform1f(program.uniforms.u_scale_b, image.toScale);

    gl.activeTexture(gl.TEXTURE0);
    painter.imageManager.bind(gl);
};

exports.setTile = function (tile: {coord: TileCoord, tileSize: number}, painter: Painter, program: Program) {
    const gl = painter.gl;

    gl.uniform1f(program.uniforms.u_tile_units_to_pixels, 1 / pixelsToTileUnits(tile, 1, painter.transform.tileZoom));

    const numTiles = Math.pow(2, tile.coord.z);
    const tileSizeAtNearestZoom = tile.tileSize * Math.pow(2, painter.transform.tileZoom) / numTiles;

    const pixelX = tileSizeAtNearestZoom * (tile.coord.x + tile.coord.w * numTiles);
    const pixelY = tileSizeAtNearestZoom * tile.coord.y;

    // split the pixel coord into two pairs of 16 bit numbers. The glsl spec only guarantees 16 bits of precision.
    gl.uniform2f(program.uniforms.u_pixel_coord_upper, pixelX >> 16, pixelY >> 16);
    gl.uniform2f(program.uniforms.u_pixel_coord_lower, pixelX & 0xFFFF, pixelY & 0xFFFF);
};
