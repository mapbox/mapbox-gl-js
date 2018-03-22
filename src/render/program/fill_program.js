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

type u_matrix = UniformMatrix4fv;
type u_world = Uniform2fv;
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

export type FillUniformsType = [ u_matrix ];

const fillUniforms = (context: Context, locations: UniformLocations): FillUniformsType => ([
    new UniformMatrix4fv(context, locations['u_matrix'])
]);

const fillUniformValues = (matrix: Float32Array): UniformValues<FillUniformsType> => ([
    matrix
]);


export type FillPatternUniformsType = [
    u_matrix,
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
    u_tile_units_to_pixels,
];

const fillPatternUniforms = (context: Context, locations: UniformLocations): FillPatternUniformsType => ([
    new UniformMatrix4fv(context, locations['u_matrix']),
    new Uniform1i(context, locations['u_image']),
    new Uniform2fv(context, locations['u_pattern_tl_a']),
    new Uniform2fv(context, locations['u_pattern_br_a']),
    new Uniform2fv(context, locations['u_pattern_tl_b']),
    new Uniform2fv(context, locations['u_pattern_br_b']),
    new Uniform2fv(context, locations['u_texsize']),
    new Uniform1f(context, locations['u_mix']),
    new Uniform2fv(context, locations['u_pattern_size_a']),
    new Uniform2fv(context, locations['u_pattern_size_b']),
    new Uniform1f(context, locations['u_scale_a']),
    new Uniform1f(context, locations['u_scale_b']),
    new Uniform2fv(context, locations['u_pixel_coord_upper']),
    new Uniform2fv(context, locations['u_pixel_coord_lower']),
    new Uniform1f(context, locations['u_tile_units_to_pixels'])
]);

const fillPatternUniformValues = (
    matrix: Float32Array,
    painter: Painter,
    image: CrossFaded<string>,
    tile: {tileID: OverscaledTileID, tileSize: number}
): UniformValues<FillPatternUniformsType> => fillUniformValues(matrix).concat(
    patternUniformValues(image, painter, tile));


export type FillOutlineUniformsType = [ u_matrix, u_world ];

const fillOutlineUniforms = (context: Context, locations: UniformLocations): FillOutlineUniformsType => ([
    new UniformMatrix4fv(context, locations['u_matrix']),
    new Uniform2fv(context, locations['u_world'])
]);

const fillOutlineUniformValues = (
    matrix: Float32Array,
    drawingBufferSize: [number, number]
): UniformValues<FillOutlineUniformsType> => ([ matrix, drawingBufferSize ]);


export type FillOutlinePatternUniformsType = [
    u_matrix,
    u_world,
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
    u_tile_units_to_pixels,
];

const fillOutlinePatternUniforms = (context: Context, locations: UniformLocations): FillOutlinePatternUniformsType => ([
    new UniformMatrix4fv(context, locations['u_matrix']),
    new Uniform2fv(context, locations['u_world']),
    new Uniform1i(context, locations['u_image']),
    new Uniform2fv(context, locations['u_pattern_tl_a']),
    new Uniform2fv(context, locations['u_pattern_br_a']),
    new Uniform2fv(context, locations['u_pattern_tl_b']),
    new Uniform2fv(context, locations['u_pattern_br_b']),
    new Uniform2fv(context, locations['u_texsize']),
    new Uniform1f(context, locations['u_mix']),
    new Uniform2fv(context, locations['u_pattern_size_a']),
    new Uniform2fv(context, locations['u_pattern_size_b']),
    new Uniform1f(context, locations['u_scale_a']),
    new Uniform1f(context, locations['u_scale_b']),
    new Uniform2fv(context, locations['u_pixel_coord_upper']),
    new Uniform2fv(context, locations['u_pixel_coord_lower']),
    new Uniform1f(context, locations['u_tile_units_to_pixels'])
]);

const fillOutlinePatternUniformValues = (
    matrix: Float32Array,
    painter: Painter,
    image: CrossFaded<string>,
    tile: {tileID: OverscaledTileID, tileSize: number},
    drawingBufferSize: [number, number]
): UniformValues<FillOutlinePatternUniformsType> =>
    fillPatternUniformValues(matrix, painter, image, tile).concat(
    [ 'u_world': drawingBufferSize ]
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
