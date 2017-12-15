// @flow

import {patternUniformValues} from './pattern';
import {
    Uniform1i,
    Uniform1f,
    Uniform2fv,
    UniformMatrix4fv,
    Uniforms
} from '../uniform_binding';
import { extend } from '../../util/util';

import type Painter from '../painter';
import type {UniformValues} from '../uniform_binding';
import type Context from '../../gl/context';
import type {CrossFaded} from '../../style/cross_faded';
import type {OverscaledTileID} from '../../source/tile_id';

export type FillUniformsType = {|
    'u_matrix': UniformMatrix4fv
|};

export type FillOutlineUniformsType = {|
    'u_matrix': UniformMatrix4fv,
    'u_world': Uniform2fv
|};

export type FillPatternUniformsType = {|
    'u_matrix': UniformMatrix4fv,
    // pattern uniforms:
    'u_image': Uniform1i,
    'u_pattern_tl_a': Uniform2fv,
    'u_pattern_br_a': Uniform2fv,
    'u_pattern_tl_b': Uniform2fv,
    'u_pattern_br_b': Uniform2fv,
    'u_texsize': Uniform2fv,
    'u_mix': Uniform1f,
    'u_pattern_size_a': Uniform2fv,
    'u_pattern_size_b': Uniform2fv,
    'u_scale_a': Uniform1f,
    'u_scale_b': Uniform1f,
    'u_pixel_coord_upper': Uniform2fv,
    'u_pixel_coord_lower': Uniform2fv,
    'u_tile_units_to_pixels': Uniform1f
|};

export type FillOutlinePatternUniformsType = {|
    'u_matrix': UniformMatrix4fv,
    'u_world': Uniform2fv,
    // pattern uniforms:
    'u_image': Uniform1i,
    'u_pattern_tl_a': Uniform2fv,
    'u_pattern_br_a': Uniform2fv,
    'u_pattern_tl_b': Uniform2fv,
    'u_pattern_br_b': Uniform2fv,
    'u_texsize': Uniform2fv,
    'u_mix': Uniform1f,
    'u_pattern_size_a': Uniform2fv,
    'u_pattern_size_b': Uniform2fv,
    'u_scale_a': Uniform1f,
    'u_scale_b': Uniform1f,
    'u_pixel_coord_upper': Uniform2fv,
    'u_pixel_coord_lower': Uniform2fv,
    'u_tile_units_to_pixels': Uniform1f
|};

const fillUniforms = (context: Context): Uniforms<FillUniformsType> => new Uniforms({
    'u_matrix': new UniformMatrix4fv(context)
});

const fillPatternUniforms = (context: Context): Uniforms<FillPatternUniformsType> => new Uniforms({
    'u_matrix': new UniformMatrix4fv(context),
    'u_image': new Uniform1i(context),
    'u_pattern_tl_a': new Uniform2fv(context),
    'u_pattern_br_a': new Uniform2fv(context),
    'u_pattern_tl_b': new Uniform2fv(context),
    'u_pattern_br_b': new Uniform2fv(context),
    'u_texsize': new Uniform2fv(context),
    'u_mix': new Uniform1f(context),
    'u_pattern_size_a': new Uniform2fv(context),
    'u_pattern_size_b': new Uniform2fv(context),
    'u_scale_a': new Uniform1f(context),
    'u_scale_b': new Uniform1f(context),
    'u_pixel_coord_upper': new Uniform2fv(context),
    'u_pixel_coord_lower': new Uniform2fv(context),
    'u_tile_units_to_pixels': new Uniform1f(context)
});

const fillOutlineUniforms = (context: Context): Uniforms<FillOutlineUniformsType> => new Uniforms({
    'u_matrix': new UniformMatrix4fv(context),
    'u_world': new Uniform2fv(context)
});

const fillOutlinePatternUniforms = (context: Context): Uniforms<FillOutlinePatternUniformsType> => new Uniforms({
    'u_matrix': new UniformMatrix4fv(context),
    'u_world': new Uniform2fv(context),
    'u_image': new Uniform1i(context),
    'u_pattern_tl_a': new Uniform2fv(context),
    'u_pattern_br_a': new Uniform2fv(context),
    'u_pattern_tl_b': new Uniform2fv(context),
    'u_pattern_br_b': new Uniform2fv(context),
    'u_texsize': new Uniform2fv(context),
    'u_mix': new Uniform1f(context),
    'u_pattern_size_a': new Uniform2fv(context),
    'u_pattern_size_b': new Uniform2fv(context),
    'u_scale_a': new Uniform1f(context),
    'u_scale_b': new Uniform1f(context),
    'u_pixel_coord_upper': new Uniform2fv(context),
    'u_pixel_coord_lower': new Uniform2fv(context),
    'u_tile_units_to_pixels': new Uniform1f(context)
});

const fillUniformValues = (matrix: Float32Array): UniformValues<FillUniformsType> => ({
    'u_matrix': matrix
});

const fillPatternUniformValues = (
    matrix: Float32Array,
    painter: Painter,
    image: CrossFaded<string>,
    tile: {tileID: OverscaledTileID, tileSize: number}
): UniformValues<FillPatternUniformsType> => extend(
    fillUniformValues(matrix),
    patternUniformValues(image, painter, tile)
);

const fillOutlineUniformValues = (
    matrix: Float32Array,
    drawingBufferSize: [number, number]
): UniformValues<FillOutlineUniformsType> => ({
    'u_matrix': matrix,
    'u_world': drawingBufferSize
});

const fillOutlinePatternUniformValues = (
    matrix: Float32Array,
    painter: Painter,
    image: CrossFaded<string>,
    tile: {tileID: OverscaledTileID, tileSize: number},
    drawingBufferSize: [number, number]
): UniformValues<FillOutlinePatternUniformsType> => extend(
    fillPatternUniformValues(matrix, painter, image, tile),
    {
        'u_world': drawingBufferSize
    }
);

export {
    fillUniforms,
    fillPatternUniforms,
    fillOutlineUniforms,
    fillOutlinePatternUniforms,
    fillUniformValues,
    fillPatternUniformValues,
    fillOutlineUniformValues,
    fillOutlinePatternUniformValues
};
