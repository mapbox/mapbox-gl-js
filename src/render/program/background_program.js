// @flow

import { patternUniformValues } from './pattern';
import {
    Uniform1i,
    Uniform1f,
    Uniform2fv,
    UniformColor,
    UniformMatrix4fv,
    Uniforms
} from '../uniform_binding';
import { extend } from '../../util/util';

import type Painter from '../painter';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type Context from '../../gl/context';
import type Color from '../../style-spec/util/color';
import type {CrossFaded} from '../../style/cross_faded';
import type {OverscaledTileID} from '../../source/tile_id';

export type BackgroundUniformsType = {|
    'u_matrix': UniformMatrix4fv,
    'u_opacity': Uniform1f,
    'u_color': UniformColor
|};

export type BackgroundPatternUniformsType = {|
    'u_matrix': UniformMatrix4fv,
    'u_opacity': Uniform1f,
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

const backgroundUniforms = (context: Context, locations: UniformLocations): Uniforms<BackgroundUniformsType> => new Uniforms({
    'u_matrix': new UniformMatrix4fv(context, locations.u_matrix),
    'u_opacity': new Uniform1f(context, locations.u_opacity),
    'u_color': new UniformColor(context, locations.u_color)
});

const backgroundPatternUniforms = (context: Context, locations: UniformLocations): Uniforms<BackgroundPatternUniformsType> => new Uniforms({
    'u_matrix': new UniformMatrix4fv(context, locations.u_matrix),
    'u_opacity': new Uniform1f(context, locations.u_opacity),
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

const backgroundUniformValues = (
    matrix: Float32Array,
    opacity: number,
    color: Color
): UniformValues<BackgroundUniformsType> => ({
    'u_matrix': matrix,
    'u_opacity': opacity,
    'u_color': color
});

const backgroundPatternUniformValues = (
    matrix: Float32Array,
    opacity: number,
    painter: Painter,
    image: CrossFaded<string>,
    tile: {tileID: OverscaledTileID, tileSize: number}
): UniformValues<BackgroundPatternUniformsType> => extend(
    patternUniformValues(image, painter, tile),
    {
        'u_matrix': matrix,
        'u_opacity': opacity
    }
);

export {
    backgroundUniforms,
    backgroundPatternUniforms,
    backgroundUniformValues,
    backgroundPatternUniformValues
};
