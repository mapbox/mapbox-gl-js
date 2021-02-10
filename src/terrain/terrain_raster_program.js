// @flow

import {
    Uniform1i,
    Uniform1f,
    Uniform3f,
    UniformMatrix4f
} from '../render/uniform_binding.js';

import type Context from '../gl/context.js';
import type {UniformValues, UniformLocations} from '../render/uniform_binding.js';

export type TerrainRasterUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_lighting_matrix': UniformMatrix4f,
    'u_image0': Uniform1i,
    'u_skirt_height': Uniform1f,
    'u_near': Uniform1f,
    'u_far': Uniform1f,
    'u_sun_direction': Uniform3f
|};

const terrainRasterUniforms = (context: Context, locations: UniformLocations): TerrainRasterUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_lighting_matrix': new UniformMatrix4f(context, locations.u_lighting_matrix),
    'u_image0': new Uniform1i(context, locations.u_image0),
    'u_skirt_height': new Uniform1f(context, locations.u_skirt_height),
    'u_near': new Uniform1f(context, locations.u_near),
    'u_far': new Uniform1f(context, locations.u_far),
    'u_sun_direction': new Uniform3f(context, locations.u_sun_direction)
});

const terrainRasterUniformValues = (
    matrix: Float32Array,
    lightingMatrix: Float32Array,
    skirtHeight: number,
    near: number,
    far: number,
    sunDirection: vec3
): UniformValues<TerrainRasterUniformsType> => ({
    'u_matrix': matrix,
    'u_lighting_matrix': lightingMatrix,
    'u_image0': 0,
    'u_skirt_height': skirtHeight,
    'u_near': near,
    'u_far': far,
    'u_sun_direction': sunDirection
});

export {terrainRasterUniforms, terrainRasterUniformValues};
