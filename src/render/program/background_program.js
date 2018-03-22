// @flow

import { patternUniformValues } from './pattern';
import {
    Uniform1i,
    Uniform1f,
    Uniform2fv,
    UniformColor,
    UniformMatrix4fv
} from '../uniform_binding';
import { extend } from '../../util/util';

import type Painter from '../painter';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type Context from '../../gl/context';
import type Color from '../../style-spec/util/color';
import type {CrossFaded} from '../../style/cross_faded';
import type {OverscaledTileID} from '../../source/tile_id';


type u_matrix = UniformMatrix4fv;
type u_opacity = Uniform1f;
type u_color = UniformColor;
type u_matrix = UniformMatrix4fv;
type u_opacity = Uniform1f;
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

export type BackgroundUniformsType = [
    u_matrix,
    u_opacity,
    u_color
];

const backgroundUniforms = (context: Context, locations: UniformLocations): BackgroundUniformsType => ([
    new UniformMatrix4fv(context, locations.u_matrix),
    new Uniform1f(context, locations.u_opacity),
    new UniformColor(context, locations.u_color)
]);

const backgroundUniformValues = (
    matrix: Float32Array,
    opacity: number,
    color: Color
): UniformValues<BackgroundUniformsType> => [
    matrix,
    opacity,
    color
];

export type BackgroundPatternUniformsType = [
    u_matrix,
    u_opacity,
    // pattern uniforms:
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

const backgroundPatternUniforms = (context: Context, locations: UniformLocations): BackgroundPatternUniformsType => ([
    new UniformMatrix4fv(context, locations.u_matrix),
    new Uniform1f(context, locations.u_opacity),
    new Uniform1i(context, locations.u_image),
    new Uniform2fv(context, locations.u_pattern_tl_a),
    new Uniform2fv(context, locations.u_pattern_br_a),
    new Uniform2fv(context, locations.u_pattern_tl_b),
    new Uniform2fv(context, locations.u_pattern_br_b),
    new Uniform2fv(context, locations.u_texsize),
    new Uniform1f(context, locations.u_mix),
    new Uniform2fv(context, locations.u_pattern_size_a),
    new Uniform2fv(context, locations.u_pattern_size_b),
    new Uniform1f(context, locations.u_scale_a),
    new Uniform1f(context, locations.u_scale_b),
    new Uniform2fv(context, locations.u_pixel_coord_upper),
    new Uniform2fv(context, locations.u_pixel_coord_lower),
    new Uniform1f(context, locations.u_tile_units_to_pixels)
]);

const backgroundPatternUniformValues = (
    matrix: Float32Array,
    opacity: number,
    painter: Painter,
    image: CrossFaded<string>,
    tile: {tileID: OverscaledTileID, tileSize: number}
): UniformValues<BackgroundPatternUniformsType> => [matrix, opacity].concat(
    patternUniformValues(image, painter, tile)
);

export {
    backgroundUniforms,
    backgroundPatternUniforms,
    backgroundUniformValues,
    backgroundPatternUniformValues
};
