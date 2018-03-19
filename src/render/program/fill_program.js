// @flow

import {patternUniformValues} from './pattern';
import {
    Uniform1i,
    Uniform1f,
    Uniform2fv,
    UniformMatrix4fv
} from '../uniform_binding';
import { extend } from '../../util/util';

import type Painter from '../painter';
import type {UniformValues, UniformLocations} from '../uniform_binding';
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

const fillUniforms = (context: Context, locations: UniformLocations): FillUniformsType => ({
    'u_matrix': new UniformMatrix4fv(context, locations.u_matrix)
});

const fillPatternUniforms = (context: Context, locations: UniformLocations): FillPatternUniformsType => ({
    'u_matrix': new UniformMatrix4fv(context, locations.u_matrix),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_pattern_tl_a': new Uniform2fv(context, locations.u_pattern_tl_a),
    'u_pattern_br_a': new Uniform2fv(context, locations.u_pattern_br_a),
    'u_pattern_tl_b': new Uniform2fv(context, locations.u_pattern_tl_b),
    'u_pattern_br_b': new Uniform2fv(context, locations.u_pattern_br_b),
    'u_texsize': new Uniform2fv(context, locations.u_texsize),
    'u_mix': new Uniform1f(context, locations.u_mix),
    'u_pattern_size_a': new Uniform2fv(context, locations.u_pattern_size_a),
    'u_pattern_size_b': new Uniform2fv(context, locations.u_pattern_size_b),
    'u_scale_a': new Uniform1f(context, locations.u_scale_a),
    'u_scale_b': new Uniform1f(context, locations.u_scale_b),
    'u_pixel_coord_upper': new Uniform2fv(context, locations.u_pixel_coord_upper),
    'u_pixel_coord_lower': new Uniform2fv(context, locations.u_pixel_coord_lower),
    'u_tile_units_to_pixels': new Uniform1f(context, locations.u_tile_units_to_pixels)
});

const fillOutlineUniforms = (context: Context, locations: UniformLocations): FillOutlineUniformsType => ({
    'u_matrix': new UniformMatrix4fv(context, locations.u_matrix),
    'u_world': new Uniform2fv(context, locations.u_world)
});

const fillOutlinePatternUniforms = (context: Context, locations: UniformLocations): FillOutlinePatternUniformsType => ({
    'u_matrix': new UniformMatrix4fv(context, locations.u_matrix),
    'u_world': new Uniform2fv(context, locations.u_world),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_pattern_tl_a': new Uniform2fv(context, locations.u_pattern_tl_a),
    'u_pattern_br_a': new Uniform2fv(context, locations.u_pattern_br_a),
    'u_pattern_tl_b': new Uniform2fv(context, locations.u_pattern_tl_b),
    'u_pattern_br_b': new Uniform2fv(context, locations.u_pattern_br_b),
    'u_texsize': new Uniform2fv(context, locations.u_texsize),
    'u_mix': new Uniform1f(context, locations.u_mix),
    'u_pattern_size_a': new Uniform2fv(context, locations.u_pattern_size_a),
    'u_pattern_size_b': new Uniform2fv(context, locations.u_pattern_size_b),
    'u_scale_a': new Uniform1f(context, locations.u_scale_a),
    'u_scale_b': new Uniform1f(context, locations.u_scale_b),
    'u_pixel_coord_upper': new Uniform2fv(context, locations.u_pixel_coord_upper),
    'u_pixel_coord_lower': new Uniform2fv(context, locations.u_pixel_coord_lower),
    'u_tile_units_to_pixels': new Uniform1f(context, locations.u_tile_units_to_pixels)
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
