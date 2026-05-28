import {
    Uniform1f,
    Uniform3f,
    UniformMatrix4f,
    type UniformValues
} from '../../../src/render/uniform_binding';

import type {mat4, vec3} from 'gl-matrix';
import type Context from '../../../src/gl/context';

export type ElevatedStructuresDepthUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_depth_bias']: Uniform1f;
};

export type ElevatedStructuresUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_ground_shadow_factor']: Uniform3f;
    ['u_opacity_multiplier']: Uniform1f;
};

export type ElevatedStructuresDepthReconstructUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_camera_pos']: Uniform3f;
    ['u_depth_bias']: Uniform1f;
    ['u_height_scale']: Uniform1f;
    ['u_reset_depth']: Uniform1f;
};

const elevatedStructuresDepthUniforms = (context: Context): ElevatedStructuresDepthUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_depth_bias': new Uniform1f(context)
});

const elevatedStructuresUniforms = (context: Context): ElevatedStructuresUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_ground_shadow_factor': new Uniform3f(context),
    'u_opacity_multiplier': new Uniform1f(context),
});

const elevatedStructuresDepthReconstructUniforms = (context: Context): ElevatedStructuresDepthReconstructUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_camera_pos': new Uniform3f(context),
    'u_depth_bias': new Uniform1f(context),
    'u_height_scale': new Uniform1f(context),
    'u_reset_depth': new Uniform1f(context)
});

const elevatedStructuresDepthUniformValues = (matrix: mat4, depthBias: number): UniformValues<ElevatedStructuresDepthUniformsType> => ({
    'u_matrix': matrix,
    'u_depth_bias': depthBias,
});

const elevatedStructuresUniformValues = (matrix: mat4, groundShadowFactor: [number, number, number]): UniformValues<ElevatedStructuresUniformsType> => ({
    'u_matrix': matrix,
    'u_ground_shadow_factor': groundShadowFactor,
    'u_opacity_multiplier': 1.0,
});

const elevatedStructuresDepthReconstructUniformValues = (
    tileMatrix: mat4,
    cameraTilePos: vec3,
    depthBias: number,
    heightScale: number,
    resetDepth: number
): UniformValues<ElevatedStructuresDepthReconstructUniformsType> => ({
    'u_matrix': tileMatrix,
    'u_camera_pos': [cameraTilePos[0], cameraTilePos[1], cameraTilePos[2]],
    'u_depth_bias': depthBias,
    'u_height_scale': heightScale,
    'u_reset_depth': resetDepth
});

export {
    elevatedStructuresDepthUniforms,
    elevatedStructuresUniforms,
    elevatedStructuresDepthReconstructUniforms,
    elevatedStructuresDepthUniformValues,
    elevatedStructuresUniformValues,
    elevatedStructuresDepthReconstructUniformValues,
};
