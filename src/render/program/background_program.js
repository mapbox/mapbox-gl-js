// @flow

import {bgPatternUniformValues} from './pattern.js';
import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    UniformColor,
    UniformMatrix4f
} from '../uniform_binding.js';
import {extend} from '../../util/util.js';

import type Painter from '../painter.js';
import type {UniformValues} from '../uniform_binding.js';
import type Context from '../../gl/context.js';
import type Color from '../../style-spec/util/color.js';
import type {CrossFaded} from '../../style/properties.js';
import type {CrossfadeParameters} from '../../style/evaluation_parameters.js';
import type {OverscaledTileID} from '../../source/tile_id.js';
import type ResolvedImage from '../../style-spec/expression/types/resolved_image.js';

export type BackgroundUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_opacity': Uniform1f,
    'u_color': UniformColor
|};

export type BackgroundPatternUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_opacity': Uniform1f,
    // pattern uniforms:
    'u_image': Uniform1i,
    'u_pattern_tl_a': Uniform2f,
    'u_pattern_br_a': Uniform2f,
    'u_pattern_tl_b': Uniform2f,
    'u_pattern_br_b': Uniform2f,
    'u_texsize': Uniform2f,
    'u_mix': Uniform1f,
    'u_pattern_size_a': Uniform2f,
    'u_pattern_size_b': Uniform2f,
    'u_scale_a': Uniform1f,
    'u_scale_b': Uniform1f,
    'u_pixel_coord_upper': Uniform2f,
    'u_pixel_coord_lower': Uniform2f,
    'u_tile_units_to_pixels': Uniform1f
|};

const backgroundUniforms = (context: Context): BackgroundUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_opacity': new Uniform1f(context),
    'u_color': new UniformColor(context)
});

const backgroundPatternUniforms = (context: Context): BackgroundPatternUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_opacity': new Uniform1f(context),
    'u_image': new Uniform1i(context),
    'u_pattern_tl_a': new Uniform2f(context),
    'u_pattern_br_a': new Uniform2f(context),
    'u_pattern_tl_b': new Uniform2f(context),
    'u_pattern_br_b': new Uniform2f(context),
    'u_texsize': new Uniform2f(context),
    'u_mix': new Uniform1f(context),
    'u_pattern_size_a': new Uniform2f(context),
    'u_pattern_size_b': new Uniform2f(context),
    'u_scale_a': new Uniform1f(context),
    'u_scale_b': new Uniform1f(context),
    'u_pixel_coord_upper': new Uniform2f(context),
    'u_pixel_coord_lower': new Uniform2f(context),
    'u_tile_units_to_pixels': new Uniform1f(context)
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
    image: CrossFaded<ResolvedImage>,
    tile: {tileID: OverscaledTileID, tileSize: number},
    crossfade: CrossfadeParameters
): UniformValues<BackgroundPatternUniformsType> => extend(
    bgPatternUniformValues(image, crossfade, painter, tile),
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
