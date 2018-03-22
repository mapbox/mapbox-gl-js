// @flow

import assert from 'assert';
import {
    Uniform1i,
    Uniform1f,
    Uniform2fv,
} from '../uniform_binding';
import pixelsToTileUnits from '../../source/pixels_to_tile_units';

import type Painter from '../painter';
import type {OverscaledTileID} from '../../source/tile_id';
import type {CrossFaded} from '../../style/cross_faded';
import type {UniformValues} from '../uniform_binding';

type u_image = Uniform1i;
type u_pattern_tl_a = Uniform2fv;
type u_pattern_br_a = Uniform2fv;
type u_pattern_tl_b = Uniform2fv;
type u_pattern_br_b = Uniform2fv;
type u_texsize = Uniform2fv;
type u_mix = Uniform1f;
type u_pattern_size_a = Uniform2fv;
type u_pattern_size_b = Uniform2fv;
type u_scale_a = Uniform1f;
type u_scale_b = Uniform1f;
type u_pixel_coord_upper = Uniform2fv;
type u_pixel_coord_lower = Uniform2fv;
type u_tile_units_to_pixels = Uniform1f;

type PatternUniformsType = [
    u_image,
    u_pattern_tl_a,
    u_pattern_br_a,
    u_pattern_tl_b,
    u_pattern_br_b,
    u_texsize,
    u_mix,
    u_pattern_size_a,
    u_pattern_size_b,
    u_scale_a,
    u_scale_b,
    u_pixel_coord_upper,
    u_pixel_coord_lower,
    u_tile_units_to_pixels
];

function patternUniformValues(image: CrossFaded<string>, painter: Painter,
        tile: {tileID: OverscaledTileID, tileSize: number}
): UniformValues<PatternUniformsType> {
    const imagePosA = painter.imageManager.getPattern(image.from);
    const imagePosB = painter.imageManager.getPattern(image.to);
    assert(imagePosA && imagePosB);
    const {width, height} = painter.imageManager.getPixelSize();

    const numTiles = Math.pow(2, tile.tileID.overscaledZ);
    const tileSizeAtNearestZoom = tile.tileSize * Math.pow(2, painter.transform.tileZoom) / numTiles;

    const pixelX = tileSizeAtNearestZoom * (tile.tileID.canonical.x + tile.tileID.wrap * numTiles);
    const pixelY = tileSizeAtNearestZoom * tile.tileID.canonical.y;

    return [
        0,
        (imagePosA: any).tl,
        (imagePosA: any).br,
        (imagePosB: any).tl,
        (imagePosB: any).br,
        [width, height],
        image.t,
        (imagePosA: any).displaySize,
        (imagePosB: any).displaySize,
        image.fromScale,
        image.toScale,
        1 / pixelsToTileUnits(tile, 1, painter.transform.tileZoom),
        // split the pixel coord into two pairs of 16 bit numbers. The glsl spec only guarantees 16 bits of precision.
        [pixelX >> 16, pixelY >> 16],
        [pixelX & 0xFFFF, pixelY & 0xFFFF]
    ];
}

export { patternUniformValues };
