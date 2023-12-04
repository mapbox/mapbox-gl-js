// @flow

import assert from 'assert';
import {
    Uniform1i,
    Uniform1f,
    Uniform2f
} from '../uniform_binding.js';
import pixelsToTileUnits from '../../source/pixels_to_tile_units.js';

import type Painter from '../painter.js';
import type {OverscaledTileID} from '../../source/tile_id.js';
import type {UniformValues} from '../uniform_binding.js';
import type Tile from '../../source/tile.js';
import type ResolvedImage from '../../style-spec/expression/types/resolved_image.js';

type BackgroundPatternUniformsType = {|
    'u_image': Uniform1i,
    'u_pattern_tl': Uniform2f,
    'u_pattern_br': Uniform2f,
    'u_texsize': Uniform2f,
    'u_pattern_size': Uniform2f,
    'u_pixel_coord_upper': Uniform2f,
    'u_pixel_coord_lower': Uniform2f,
    'u_tile_units_to_pixels': Uniform1f
|};

export type PatternUniformsType = {|
    'u_image': Uniform1i,
    'u_texsize': Uniform2f,
    'u_tile_units_to_pixels': Uniform1f,
    'u_pixel_coord_upper': Uniform2f,
    'u_pixel_coord_lower': Uniform2f
|};

function patternUniformValues(painter: Painter, tile: Tile): UniformValues<PatternUniformsType> {

    const numTiles = Math.pow(2, tile.tileID.overscaledZ);
    const tileSizeAtNearestZoom = tile.tileSize * Math.pow(2, painter.transform.tileZoom) / numTiles;

    const pixelX = tileSizeAtNearestZoom * (tile.tileID.canonical.x + tile.tileID.wrap * numTiles);
    const pixelY = tileSizeAtNearestZoom * tile.tileID.canonical.y;

    return {
        'u_image': 0,
        'u_texsize': tile.imageAtlasTexture ? tile.imageAtlasTexture.size : [0, 0],
        'u_tile_units_to_pixels': 1 / pixelsToTileUnits(tile, 1, painter.transform.tileZoom),
        // split the pixel coord into two pairs of 16 bit numbers. The glsl spec only guarantees 16 bits of precision.
        'u_pixel_coord_upper': [pixelX >> 16, pixelY >> 16],
        'u_pixel_coord_lower': [pixelX & 0xFFFF, pixelY & 0xFFFF]
    };
}

function bgPatternUniformValues(
    image: ResolvedImage,
    scope: string,
    painter: Painter,
    tile: {tileID: OverscaledTileID, tileSize: number}
): UniformValues<BackgroundPatternUniformsType> {
    const imagePos = painter.imageManager.getPattern(image.toString(), scope);
    assert(imagePos);
    const {width, height} = painter.imageManager.getPixelSize(scope);

    const numTiles = Math.pow(2, tile.tileID.overscaledZ);
    const tileSizeAtNearestZoom = tile.tileSize * Math.pow(2, painter.transform.tileZoom) / numTiles;

    const pixelX = tileSizeAtNearestZoom * (tile.tileID.canonical.x + tile.tileID.wrap * numTiles);
    const pixelY = tileSizeAtNearestZoom * tile.tileID.canonical.y;

    return {
        'u_image': 0,
        'u_pattern_tl': (imagePos: any).tl,
        'u_pattern_br': (imagePos: any).br,
        'u_texsize': [width, height],
        'u_pattern_size': (imagePos: any).displaySize,
        'u_tile_units_to_pixels': 1 / pixelsToTileUnits(tile, 1, painter.transform.tileZoom),
        // split the pixel coord into two pairs of 16 bit numbers. The glsl spec only guarantees 16 bits of precision.
        'u_pixel_coord_upper': [pixelX >> 16, pixelY >> 16],
        'u_pixel_coord_lower': [pixelX & 0xFFFF, pixelY & 0xFFFF]
    };
}
export {bgPatternUniformValues, patternUniformValues};
