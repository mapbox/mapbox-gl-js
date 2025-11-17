import {Uniform1i, Uniform1f, Uniform3f, UniformMatrix4f} from '../render/uniform_binding';

import type {mat4} from 'gl-matrix';
import type Context from '../gl/context';
import type {UniformValues} from '../render/uniform_binding';

export type TerrainRasterUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_image0']: Uniform1i;
    ['u_image1']: Uniform1i;
    ['u_skirt_height']: Uniform1f;
    ['u_ground_shadow_factor']: Uniform3f;
    ['u_emissive_texture_available']: Uniform1f;
};

const terrainRasterUniforms = (context: Context): TerrainRasterUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_image0': new Uniform1i(context),
    'u_image1': new Uniform1i(context),
    'u_skirt_height': new Uniform1f(context),
    'u_ground_shadow_factor': new Uniform3f(context),
    'u_emissive_texture_available': new Uniform1f(context)
});

const terrainRasterUniformValues = (
    matrix: mat4,
    skirtHeight: number,
    groundShadowFactor: [number, number, number],
    emissiveTextureAvailable: number,
): UniformValues<TerrainRasterUniformsType> => ({
    'u_matrix': matrix as Float32Array,
    'u_image0': 0,
    'u_image1': 1,
    'u_skirt_height': skirtHeight,
    'u_ground_shadow_factor': groundShadowFactor,
    'u_emissive_texture_available': emissiveTextureAvailable
});

export {terrainRasterUniforms, terrainRasterUniformValues};
