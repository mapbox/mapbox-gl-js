import {patternUniformValues} from './pattern';
import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform3f,
    UniformMatrix4f,
    type UniformValues
} from '../uniform_binding';

import type {mat4} from 'gl-matrix';
import type Painter from '../painter';
import type Context from '../../gl/context';
import type Tile from '../../source/tile';

export type FillUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_emissive_strength']: Uniform1f;
    ['u_ground_shadow_factor']: Uniform3f;
    ['u_opacity_multiplier']: Uniform1f;
};

export type FillOutlineUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_emissive_strength']: Uniform1f;
    ['u_world']: Uniform2f;
    ['u_ground_shadow_factor']: Uniform3f;
    ['u_opacity_multiplier']: Uniform1f;
};

export type FillPatternUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_emissive_strength']: Uniform1f;
    // pattern uniforms:
    ['u_texsize']: Uniform2f;
    ['u_image']: Uniform1i;
    ['u_pixel_coord_upper']: Uniform2f;
    ['u_pixel_coord_lower']: Uniform2f;
    ['u_tile_units_to_pixels']: Uniform1f;
    ['u_ground_shadow_factor']: Uniform3f;
    ['u_pattern_transition']: Uniform1f;
    ['u_opacity_multiplier']: Uniform1f;
};

export type FillOutlinePatternUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_emissive_strength']: Uniform1f;
    ['u_world']: Uniform2f;
    // pattern uniforms:
    ['u_texsize']: Uniform2f;
    ['u_image']: Uniform1i;
    ['u_pixel_coord_upper']: Uniform2f;
    ['u_pixel_coord_lower']: Uniform2f;
    ['u_tile_units_to_pixels']: Uniform1f;
    ['u_ground_shadow_factor']: Uniform3f;
    ['u_pattern_transition']: Uniform1f;
    ['u_opacity_multiplier']: Uniform1f;
};

export type FillDefinesType = 'ELEVATED_ROADS' | 'DEPTH_RECONSTRUCTION' | 'FILL_PATTERN_TRANSITION';

const fillUniforms = (context: Context): FillUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_emissive_strength': new Uniform1f(context),
    'u_ground_shadow_factor': new Uniform3f(context),
    'u_opacity_multiplier': new Uniform1f(context),
});

const fillPatternUniforms = (context: Context): FillPatternUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_emissive_strength': new Uniform1f(context),
    'u_image': new Uniform1i(context),
    'u_texsize': new Uniform2f(context),
    'u_pixel_coord_upper': new Uniform2f(context),
    'u_pixel_coord_lower': new Uniform2f(context),
    'u_tile_units_to_pixels': new Uniform1f(context),
    'u_ground_shadow_factor': new Uniform3f(context),
    'u_pattern_transition': new Uniform1f(context),
    'u_opacity_multiplier': new Uniform1f(context),
});

const fillOutlineUniforms = (context: Context): FillOutlineUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_emissive_strength': new Uniform1f(context),
    'u_world': new Uniform2f(context),
    'u_ground_shadow_factor': new Uniform3f(context),
    'u_opacity_multiplier': new Uniform1f(context),
});

const fillOutlinePatternUniforms = (context: Context): FillOutlinePatternUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_emissive_strength': new Uniform1f(context),
    'u_world': new Uniform2f(context),
    'u_image': new Uniform1i(context),
    'u_texsize': new Uniform2f(context),
    'u_pixel_coord_upper': new Uniform2f(context),
    'u_pixel_coord_lower': new Uniform2f(context),
    'u_tile_units_to_pixels': new Uniform1f(context),
    'u_ground_shadow_factor': new Uniform3f(context),
    'u_pattern_transition': new Uniform1f(context),
    'u_opacity_multiplier': new Uniform1f(context),
});

const fillUniformValues = (matrix: mat4, emissiveStrength: number, groundShadowFactor: [number, number, number]): UniformValues<FillUniformsType> => ({
    'u_matrix': matrix,
    'u_emissive_strength': emissiveStrength,
    'u_ground_shadow_factor': groundShadowFactor,
    'u_opacity_multiplier': 1,
});

const fillPatternUniformValues = (
    matrix: mat4,
    emissiveStrength: number,
    painter: Painter,
    tile: Tile,
    groundShadowFactor: [number, number, number],
    patternTransition: number = 0
): UniformValues<FillPatternUniformsType> => Object.assign(
    fillUniformValues(matrix, emissiveStrength, groundShadowFactor),
    patternUniformValues(painter, tile, patternTransition)
);

const fillOutlineUniformValues = (
    matrix: mat4,
    emissiveStrength: number,
    drawingBufferSize: [number, number],
    groundShadowFactor: [number, number, number],
): UniformValues<FillOutlineUniformsType> => ({
    'u_matrix': matrix,
    'u_world': drawingBufferSize,
    'u_emissive_strength': emissiveStrength,
    'u_ground_shadow_factor': groundShadowFactor,
    'u_opacity_multiplier': 1,
});

const fillOutlinePatternUniformValues = (
    matrix: mat4,
    emissiveStrength: number,
    painter: Painter,
    tile: Tile,
    drawingBufferSize: [number, number],
    groundShadowFactor: [number, number, number],
    patternTransision: number = 0
): UniformValues<FillOutlinePatternUniformsType> => Object.assign(
    fillPatternUniformValues(matrix, emissiveStrength, painter, tile, groundShadowFactor, patternTransision),
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
    fillOutlinePatternUniformValues,
};
