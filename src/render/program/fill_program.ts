import {patternUniformValues} from './pattern';
import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform3f,
    UniformMatrix4f,
    type UniformValues
} from '../uniform_binding';
import {extend} from '../../util/util';

import type {mat4, vec3} from 'gl-matrix';
import type Painter from '../painter';
import type Context from '../../gl/context';
import type Tile from '../../source/tile';

export type FillUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_emissive_strength']: Uniform1f;
    ['u_ground_shadow_factor']: Uniform3f;
};

export type FillOutlineUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_emissive_strength']: Uniform1f;
    ['u_world']: Uniform2f;
    ['u_ground_shadow_factor']: Uniform3f;
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
};

export type ElevatedStructuresDepthUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_depth_bias']: Uniform1f;
};

export type ElevatedStructuresUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_ground_shadow_factor']: Uniform3f;
};

export type ElevatedStructuresDepthReconstructUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_camera_pos']: Uniform3f;
    ['u_depth_bias']: Uniform1f;
    ['u_height_scale']: Uniform1f;
    ['u_reset_depth']: Uniform1f;
};

export type FillDefinesType = 'ELEVATED_ROADS' | 'DEPTH_RECONSTRUCTION' | 'FILL_PATTERN_TRANSITION';

const fillUniforms = (context: Context): FillUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_emissive_strength': new Uniform1f(context),
    'u_ground_shadow_factor': new Uniform3f(context),
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
    'u_pattern_transition': new Uniform1f(context)
});

const fillOutlineUniforms = (context: Context): FillOutlineUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_emissive_strength': new Uniform1f(context),
    'u_world': new Uniform2f(context),
    'u_ground_shadow_factor': new Uniform3f(context),
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
    'u_pattern_transition': new Uniform1f(context)
});

const elevatedStructuresDepthUniforms = (context: Context): ElevatedStructuresDepthUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_depth_bias': new Uniform1f(context)
});

const elevatedStructuresUniforms = (context: Context): ElevatedStructuresUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_ground_shadow_factor': new Uniform3f(context),
});

const elevatedStructuresDepthReconstructUniforms = (context: Context): ElevatedStructuresDepthReconstructUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_camera_pos': new Uniform3f(context),
    'u_depth_bias': new Uniform1f(context),
    'u_height_scale': new Uniform1f(context),
    'u_reset_depth': new Uniform1f(context)
});

const fillUniformValues = (matrix: mat4, emissiveStrength: number, groundShadowFactor: [number, number, number]): UniformValues<FillUniformsType> => ({
    'u_matrix': matrix as Float32Array,
    'u_emissive_strength': emissiveStrength,
    'u_ground_shadow_factor': groundShadowFactor,
});

const fillPatternUniformValues = (
    matrix: mat4,
    emissiveStrength: number,
    painter: Painter,
    tile: Tile,
    groundShadowFactor: [number, number, number],
    patternTransition: number = 0
): UniformValues<FillPatternUniformsType> => extend(
    fillUniformValues(matrix, emissiveStrength, groundShadowFactor),
    patternUniformValues(painter, tile, patternTransition)
);

const fillOutlineUniformValues = (
    matrix: mat4,
    emissiveStrength: number,
    drawingBufferSize: [number, number],
    groundShadowFactor: [number, number, number]
): UniformValues<FillOutlineUniformsType> => ({
    'u_matrix': matrix as Float32Array,
    'u_world': drawingBufferSize,
    'u_emissive_strength': emissiveStrength,
    'u_ground_shadow_factor': groundShadowFactor,
});

const fillOutlinePatternUniformValues = (
    matrix: mat4,
    emissiveStrength: number,
    painter: Painter,
    tile: Tile,
    drawingBufferSize: [number, number],
    groundShadowFactor: [number, number, number],
    patternTransision: number = 0
): UniformValues<FillOutlinePatternUniformsType> => extend(
    fillPatternUniformValues(matrix, emissiveStrength, painter, tile, groundShadowFactor, patternTransision),
    {
        'u_world': drawingBufferSize
    }
);

const elevatedStructuresDepthUniformValues = (matrix: mat4, depthBias: number): UniformValues<ElevatedStructuresDepthUniformsType> => ({
    'u_matrix': matrix as Float32Array,
    'u_depth_bias': depthBias,
});

const elevatedStructuresUniformValues = (matrix: mat4, groundShadowFactor: [number, number, number]): UniformValues<ElevatedStructuresUniformsType> => ({
    'u_matrix': matrix as Float32Array,
    'u_ground_shadow_factor': groundShadowFactor,
});

const elevatedStructuresDepthReconstructUniformValues = (
    tileMatrix: mat4,
    cameraTilePos: vec3,
    depthBias: number,
    heightScale: number,
    resetDepth: number
): UniformValues<ElevatedStructuresDepthReconstructUniformsType> => ({
    'u_matrix': tileMatrix as Float32Array,
    'u_camera_pos': [cameraTilePos[0], cameraTilePos[1], cameraTilePos[2]],
    'u_depth_bias': depthBias,
    'u_height_scale': heightScale,
    'u_reset_depth': resetDepth
});

export {
    fillUniforms,
    fillPatternUniforms,
    fillOutlineUniforms,
    fillOutlinePatternUniforms,
    elevatedStructuresDepthUniforms,
    elevatedStructuresUniforms,
    elevatedStructuresDepthReconstructUniforms,
    fillUniformValues,
    fillPatternUniformValues,
    fillOutlineUniformValues,
    fillOutlinePatternUniformValues,
    elevatedStructuresDepthUniformValues,
    elevatedStructuresUniformValues,
    elevatedStructuresDepthReconstructUniformValues
};
