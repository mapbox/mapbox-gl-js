// @flow

import {
    Uniform1i,
    Uniform1f,
    Uniform3f,
    UniformMatrix4f
} from '../render/uniform_binding.js';

import type Context from '../gl/context.js';
import type {UniformValues} from '../render/uniform_binding.js';

export type TerrainRasterUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_image0': Uniform1i,
    'u_skirt_height': Uniform1f,
    'u_ground_shadow_factor': Uniform3f
|};

const terrainRasterUniforms = (context: Context): TerrainRasterUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_image0': new Uniform1i(context),
    'u_skirt_height': new Uniform1f(context),
    'u_ground_shadow_factor': new Uniform3f(context)
});

const terrainRasterUniformValues = (
    matrix: Float32Array,
    skirtHeight: number,
    groundShadowFactor: [number, number, number]
): UniformValues<TerrainRasterUniformsType> => ({
    'u_matrix': matrix,
    'u_image0': 0,
    'u_skirt_height': skirtHeight,
    'u_ground_shadow_factor': groundShadowFactor
});

export {terrainRasterUniforms, terrainRasterUniformValues};
