// @flow

import {
    Uniform1i,
    Uniform1f,
    Uniform2fv,
    UniformMatrix4fv,
    Uniforms
} from '../uniform_binding';
import pixelsToTileUnits from '../../source/pixels_to_tile_units';
import { extend } from '../../util/util';
import browser from '../../util/browser';

import type Context from '../../gl/context';
import type {UniformValues} from '../uniform_binding';
import type Transform from '../../geo/transform';
import type Tile from '../../source/tile';
import type {CrossFaded} from '../../style/cross_faded';
import type LineStyleLayer from '../../style/style_layer/line_style_layer';
import type Painter from '../painter';

export type LineUniformsType = {|
    'u_matrix': UniformMatrix4fv,
    'u_ratio': Uniform1f,
    'u_gl_units_to_pixels': Uniform2fv
|};

export type LinePatternUniformsType = {|
    'u_matrix': UniformMatrix4fv,
    'u_ratio': Uniform1f,
    'u_gl_units_to_pixels': Uniform2fv,
    'u_pattern_size_a': Uniform2fv,
    'u_pattern_size_b': Uniform2fv,
    'u_texsize': Uniform2fv,
    'u_image': Uniform1i,
    'u_pattern_tl_a': Uniform2fv,
    'u_pattern_br_a': Uniform2fv,
    'u_pattern_tl_b': Uniform2fv,
    'u_pattern_br_b': Uniform2fv,
    'u_fade': Uniform1f
|};

export type LineSDFUniformsType = {|
    'u_matrix': UniformMatrix4fv,
    'u_ratio': Uniform1f,
    'u_gl_units_to_pixels': Uniform2fv,
    'u_patternscale_a': Uniform2fv,
    'u_patternscale_b': Uniform2fv,
    'u_sdfgamma': Uniform1f,
    'u_image': Uniform1i,
    'u_tex_y_a': Uniform1f,
    'u_tex_y_b': Uniform1f,
    'u_mix': Uniform1f
|};

const lineUniforms = (context: Context): Uniforms<LineUniformsType> => new Uniforms({
    'u_matrix': new UniformMatrix4fv(context),
    'u_ratio': new Uniform1f(context),
    'u_gl_units_to_pixels': new Uniform2fv(context)
});

const linePatternUniforms = (context: Context): Uniforms<LinePatternUniformsType> => new Uniforms({
    'u_matrix': new UniformMatrix4fv(context),
    'u_ratio': new Uniform1f(context),
    'u_gl_units_to_pixels': new Uniform2fv(context),
    'u_pattern_size_a': new Uniform2fv(context),
    'u_pattern_size_b': new Uniform2fv(context),
    'u_texsize': new Uniform2fv(context),
    'u_image': new Uniform1i(context),
    'u_pattern_tl_a': new Uniform2fv(context),
    'u_pattern_br_a': new Uniform2fv(context),
    'u_pattern_tl_b': new Uniform2fv(context),
    'u_pattern_br_b': new Uniform2fv(context),
    'u_fade': new Uniform1f(context)
});

const lineSDFUniforms = (context: Context): Uniforms<LineSDFUniformsType> => new Uniforms({
    'u_matrix': new UniformMatrix4fv(context),
    'u_ratio': new Uniform1f(context),
    'u_gl_units_to_pixels': new Uniform2fv(context),
    'u_patternscale_a': new Uniform2fv(context),
    'u_patternscale_b': new Uniform2fv(context),
    'u_sdfgamma': new Uniform1f(context),
    'u_image': new Uniform1i(context),
    'u_tex_y_a': new Uniform1f(context),
    'u_tex_y_b': new Uniform1f(context),
    'u_mix': new Uniform1f(context)
});

const lineUniformValues = (
    painter: Painter,
    tile: Tile,
    layer: LineStyleLayer
): UniformValues<LineUniformsType> => {
    const transform = painter.transform;

    return {
        'u_matrix': calculateMatrix(painter, tile, layer),
        'u_ratio': 1 / pixelsToTileUnits(tile, 1, transform.zoom),
        'u_gl_units_to_pixels': [
            1 / transform.pixelsToGLUnits[0],
            1 / transform.pixelsToGLUnits[1]
        ]
    };
};

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

    return extend(lineUniformValues(painter, tile, layer), {
        'u_pattern_size_a': [
            imagePosA.displaySize[0] * image.fromScale / tileRatio,
            imagePosA.displaySize[1]
        ],
        'u_pattern_size_b': [
            imagePosB.displaySize[0] * image.toScale / tileRatio,
            imagePosB.displaySize[1]
        ],
        'u_texsize': [pixelSize.width, pixelSize.height],
        'u_image': 0,
        'u_pattern_tl_a': imagePosA.tl,
        'u_pattern_br_a': imagePosA.br,
        'u_pattern_tl_b': imagePosB.tl,
        'u_pattern_br_b': imagePosB.br,
        'u_fade': image.t
    });
};

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

    return extend(lineUniformValues(painter, tile, layer), {
        'u_patternscale_a': [tileRatio / widthA, -posA.height / 2],
        'u_patternscale_b': [tileRatio / widthB, -posB.height / 2],
        'u_sdfgamma': lineAtlas.width / (Math.min(widthA, widthB) * 256 * browser.devicePixelRatio) / 2,
        'u_image': 0,
        'u_tex_y_a': posA.y,
        'u_tex_y_b': posB.y,
        'u_mix': dasharray.t
    });
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
