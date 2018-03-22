// @flow

import {
    Uniform1i,
    Uniform1f,
    Uniform2fv,
    UniformMatrix4fv
} from '../uniform_binding';
import pixelsToTileUnits from '../../source/pixels_to_tile_units';
import { extend } from '../../util/util';
import browser from '../../util/browser';

import type Context from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type Transform from '../../geo/transform';
import type Tile from '../../source/tile';
import type {CrossFaded} from '../../style/cross_faded';
import type LineStyleLayer from '../../style/style_layer/line_style_layer';
import type Painter from '../painter';

type u_matrix = UniformMatrix4fv;
type u_ratio = Uniform1f;
type u_gl_units_to_pixels = Uniform2fv;
type u_pattern_size_a = Uniform2fv;
type u_pattern_size_b = Uniform2fv;
type u_texsize = Uniform2fv;
type u_image = Uniform1i;
type u_pattern_tl_a = Uniform2fv;
type u_pattern_br_a = Uniform2fv;
type u_pattern_tl_b = Uniform2fv;
type u_pattern_br_b = Uniform2fv;
type u_fade = Uniform1f;
type u_patternscale_a = Uniform2fv;
type u_patternscale_b = Uniform2fv;
type u_sdfgamma = Uniform1f;
type u_image = Uniform1i;
type u_tex_y_a = Uniform1f;
type u_tex_y_b = Uniform1f;
type u_mix = Uniform1f;

export type LineUniformsType = [ u_matrix, u_ratio, u_gl_units_to_pixels ];

const lineUniforms = (context: Context, locations: UniformLocations): LineUniformsType => ([
    new UniformMatrix4fv(context, locations['u_matrix']),
    new Uniform1f(context, locations['u_ratio']),
    new Uniform2fv(context, locations['u_gl_units_to_pixels'])
]);

const lineUniformValues = (
    painter: Painter,
    tile: Tile,
    layer: LineStyleLayer
): UniformValues<LineUniformsType> => {
    const transform = painter.transform;

    return [
        calculateMatrix(painter, tile, layer),
        1 / pixelsToTileUnits(tile, 1, transform.zoom),
        [ 1 / transform.pixelsToGLUnits[0],
          1 / transform.pixelsToGLUnits[1] ]
    ];
};


export type LinePatternUniformsType = [ u_matrix, u_ratio, u_gl_units_to_pixels,
    u_pattern_size_a, u_pattern_size_b, u_texsize, u_image, u_pattern_tl_a,
    u_pattern_br_a, u_pattern_tl_b, u_pattern_br_b, u_fade ];

const linePatternUniforms = (context: Context, locations: UniformLocations): LinePatternUniformsType => ([
    new UniformMatrix4fv(context, locations['u_matrix']),
    new Uniform1f(context, locations['u_ratio']),
    new Uniform2fv(context, locations['u_gl_units_to_pixels']),
    new Uniform2fv(context, locations['u_pattern_size_a']),
    new Uniform2fv(context, locations['u_pattern_size_b']),
    new Uniform2fv(context, locations['u_texsize']),
    new Uniform1i(context, locations['u_image']),
    new Uniform2fv(context, locations['u_pattern_tl_a']),
    new Uniform2fv(context, locations['u_pattern_br_a']),
    new Uniform2fv(context, locations['u_pattern_tl_b']),
    new Uniform2fv(context, locations['u_pattern_br_b']),
    new Uniform1f(context, locations['u_fade'])
]);

const linePatternUniformValues = (
    painter: Painter,
    tile: Tile,
    layer: LineStyleLayer,
    image: CrossFaded<string>
): UniformValues<LinePatternUniformsType> => {
    const pixelSize = painter.imageManager.getPixelSize();
    const tileRatio = calculateTileRatio(tile, painter.transform);

    const imagePosA: any = painter.imageManager.getPattern(image.from);
    const imagePosB: any = painter.imageManager.getPattern(image.to);

    return lineUniformValues(painter, tile, layer).concat([
        [ imagePosA.displaySize[0] * image.fromScale / tileRatio,
          imagePosA.displaySize[1] ],
        [ imagePosB.displaySize[0] * image.toScale / tileRatio,
          imagePosB.displaySize[1] ],
        [ pixelSize.width, pixelSize.height ],
        0,
        imagePosA.tl,
        imagePosA.br,
        imagePosB.tl,
        imagePosB.br,
        image.t
    ]);
};


export type LineSDFUniformsType = [ u_matrix, u_ratio, u_gl_units_to_pixels,
    u_patternscale_a, u_patternscale_b, u_sdfgamma, u_image, u_tex_y_a,
    u_tex_y_b, u_mix ];

const lineSDFUniforms = (context: Context, locations: UniformLocations): LineSDFUniformsType => ([
    new UniformMatrix4fv(context, locations['u_matrix']),
    new Uniform1f(context, locations['u_ratio']),
    new Uniform2fv(context, locations['u_gl_units_to_pixels']),
    new Uniform2fv(context, locations['u_patternscale_a']),
    new Uniform2fv(context, locations['u_patternscale_b']),
    new Uniform1f(context, locations['u_sdfgamma']),
    new Uniform1i(context, locations['u_image']),
    new Uniform1f(context, locations['u_tex_y_a']),
    new Uniform1f(context, locations['u_tex_y_b']),
    new Uniform1f(context, locations['u_mix'])
]);

const lineSDFUniformValues = (
    painter: Painter,
    tile: Tile,
    layer: LineStyleLayer,
    dasharray: CrossFaded<Array<number>>
): UniformValues<LineSDFUniformsType> => {
    const transform = painter.transform;
    const lineAtlas = painter.lineAtlas;
    const tileRatio = calculateTileRatio(tile, transform);

    const round = layer.layout.get('line-cap') === 'round';

    const posA = lineAtlas.getDash(dasharray.from, round);
    const posB = lineAtlas.getDash(dasharray.to, round);

    const widthA = posA.width * dasharray.fromScale;
    const widthB = posB.width * dasharray.toScale;

    return lineUniformValues(painter, tile, layer).concat([
        [tileRatio / widthA, -posA.height / 2],
        [tileRatio / widthB, -posB.height / 2],
        lineAtlas.width / (Math.min(widthA, widthB) * 256 * browser.devicePixelRatio) / 2,
        0,
        posA.y,
        posB.y,
        dasharray.t
    ]);
};


function calculateTileRatio(tile: Tile, transform: Transform) {
    return 1 / pixelsToTileUnits(tile, 1, transform.tileZoom);
}

function calculateMatrix(painter, tile, layer) {
    return painter.translatePosMatrix(
        tile.tileID.posMatrix,
        tile,
        layer.paint.get('line-translate'),
        layer.paint.get('line-translate-anchor')
    );
}

export {
    lineUniforms,
    linePatternUniforms,
    lineSDFUniforms,
    lineUniformValues,
    linePatternUniformValues,
    lineSDFUniformValues
};
