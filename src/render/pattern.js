
const assert = require('assert');

const pixelsToTileUnits = require('../source/pixels_to_tile_units');

/**
 * Checks whether a pattern image is needed, and if it is, whether it is not loaded.
 *
 * @returns {boolean} true if a needed image is missing and rendering needs to be skipped.
 */
exports.isPatternMissing = function(image, painter) {
    if (!image) return false;
    const imagePosA = painter.spriteAtlas.getPattern(image.from);
    const imagePosB = painter.spriteAtlas.getPattern(image.to);
    return !imagePosA || !imagePosB;
};

exports.prepare = function (image, painter, program) {
    const gl = painter.gl;

    const imagePosA = painter.spriteAtlas.getPattern(image.from);
    const imagePosB = painter.spriteAtlas.getPattern(image.to);
    assert(imagePosA && imagePosB);

    gl.uniform1i(program.u_image, 0);
    gl.uniform2fv(program.u_pattern_tl_a, imagePosA.tl);
    gl.uniform2fv(program.u_pattern_br_a, imagePosA.br);
    gl.uniform2fv(program.u_pattern_tl_b, imagePosB.tl);
    gl.uniform2fv(program.u_pattern_br_b, imagePosB.br);
    gl.uniform2fv(program.u_texsize, painter.spriteAtlas.getPixelSize());
    gl.uniform1f(program.u_mix, image.t);
    gl.uniform2fv(program.u_pattern_size_a, imagePosA.displaySize);
    gl.uniform2fv(program.u_pattern_size_b, imagePosB.displaySize);
    gl.uniform1f(program.u_scale_a, image.fromScale);
    gl.uniform1f(program.u_scale_b, image.toScale);

    gl.activeTexture(gl.TEXTURE0);
    painter.spriteAtlas.bind(gl, true);
};

exports.setTile = function (tile, painter, program) {
    const gl = painter.gl;

    gl.uniform1f(program.u_tile_units_to_pixels, 1 / pixelsToTileUnits(tile, 1, painter.transform.tileZoom));

    const numTiles = Math.pow(2, tile.coord.z);
    const tileSizeAtNearestZoom = tile.tileSize * Math.pow(2, painter.transform.tileZoom) / numTiles;

    const pixelX = tileSizeAtNearestZoom * (tile.coord.x + tile.coord.w * numTiles);
    const pixelY = tileSizeAtNearestZoom * tile.coord.y;

    // split the pixel coord into two pairs of 16 bit numbers. The glsl spec only guarantees 16 bits of precision.
    gl.uniform2f(program.u_pixel_coord_upper, pixelX >> 16, pixelY >> 16);
    gl.uniform2f(program.u_pixel_coord_lower, pixelX & 0xFFFF, pixelY & 0xFFFF);
};
