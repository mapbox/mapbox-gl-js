import assert from 'assert';
import pixelsToTileUnits from '../../source/pixels_to_tile_units';

import type {
    Uniform1i,
    Uniform1f,
    Uniform2f
    , UniformValues} from '../uniform_binding';
import type Painter from '../painter';
import type {OverscaledTileID} from '../../source/tile_id';
import type Tile from '../../source/tile';
import type ResolvedImage from '../../style-spec/expression/types/resolved_image';
import type {ImagePosition} from "../image_atlas";

type BackgroundPatternUniformsType = {
    ['u_image']: Uniform1i;
    ['u_pattern_tl']: Uniform2f;
    ['u_pattern_br']: Uniform2f;
    ['u_texsize']: Uniform2f;
    ['u_pattern_size']: Uniform2f;
    ['u_pixel_coord_upper']: Uniform2f;
    ['u_pixel_coord_lower']: Uniform2f;
    ['u_pattern_units_to_pixels']: Uniform2f;
};

export type PatternUniformsType = {
    ['u_image']: Uniform1i;
    ['u_texsize']: Uniform2f;
    ['u_tile_units_to_pixels']: Uniform1f;
    ['u_pixel_coord_upper']: Uniform2f;
    ['u_pixel_coord_lower']: Uniform2f;
    ['u_pattern_transition']: Uniform1f;
};

function patternUniformValues(painter: Painter, tile: Tile, patternTransition: number = 0): UniformValues<PatternUniformsType> {

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
        'u_pixel_coord_lower': [pixelX & 0xFFFF, pixelY & 0xFFFF],
        'u_pattern_transition': patternTransition,
    };
}

function bgPatternUniformValues(
    image: ResolvedImage,
    scope: string,
    patternPosition: ImagePosition | null | undefined,
    painter: Painter,
    isViewport: boolean,
    tile: {
        tileID: OverscaledTileID;
        tileSize: number;
    },
): UniformValues<BackgroundPatternUniformsType> {
    assert(patternPosition);
    const {width, height} = painter.imageManager.getPixelSize(scope);

    const numTiles = Math.pow(2, tile.tileID.overscaledZ);
    const tileSizeAtNearestZoom = tile.tileSize * Math.pow(2, painter.transform.tileZoom) / numTiles;

    const pixelX = tileSizeAtNearestZoom * (tile.tileID.canonical.x + tile.tileID.wrap * numTiles);
    const pixelY = tileSizeAtNearestZoom * tile.tileID.canonical.y;

    return {
        'u_image': 0,
        'u_pattern_tl': patternPosition.tl,
        'u_pattern_br': patternPosition.br,
        'u_texsize': [width, height],
        'u_pattern_size': patternPosition.displaySize,
        'u_pattern_units_to_pixels': isViewport ? [painter.transform.width, -1.0 * painter.transform.height] : [1 / pixelsToTileUnits(tile, 1, painter.transform.tileZoom), 1 / pixelsToTileUnits(tile, 1, painter.transform.tileZoom)],
        // split the pixel coord into two pairs of 16 bit numbers. The glsl spec only guarantees 16 bits of precision.
        'u_pixel_coord_upper': [pixelX >> 16, pixelY >> 16],
        'u_pixel_coord_lower': [pixelX & 0xFFFF, pixelY & 0xFFFF]
    };
}
export {bgPatternUniformValues, patternUniformValues};
