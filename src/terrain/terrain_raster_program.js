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
    'u_fog_start': Uniform1f,
    'u_fog_end': Uniform1f,
    'u_fog_intensity': Uniform1f,
    'u_fog_color': Uniform3f,
    'u_sun_direction': Uniform3f
|};

const terrainRasterUniforms = (context: Context, locations: UniformLocations): TerrainRasterUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_lighting_matrix': new UniformMatrix4f(context, locations.u_lighting_matrix),
    'u_image0': new Uniform1i(context, locations.u_image0),
    'u_cubemap': new Uniform1i(context, locations.u_cubemap),
    'u_opacity': new Uniform1f(context, locations.u_opacity),
    'u_skirt_height': new Uniform1f(context, locations.u_skirt_height),
    'u_near': new Uniform1f(context, locations.u_near),
    'u_far': new Uniform1f(context, locations.u_far),
    'u_fog_start': new Uniform1f(context, locations.u_fog_start),
    'u_fog_end': new Uniform1f(context, locations.u_fog_end),
    'u_fog_intensity': new Uniform1f(context, locations.u_fog_intensity),
    'u_fog_color': new Uniform3f(context, locations.u_fog_color),
    'u_fog_blend': new Uniform1f(context, locations.u_fog_blend),
    'u_sun_direction': new Uniform3f(context, locations.u_sun_direction),
    'u_temporal_offset': new Uniform1f(context, locations.u_temporal_offset),
});

const terrainRasterUniformValues = (
    matrix: Float32Array,
    lightingMatrix: Float32Array,
    skirtHeight: number,
    near: number,
    far: number,
    fogStart,
    fogEnd,
    fogIntensity,
    fogColor: vec3,
    sunDirection: vec3,
    skyUniforms: any
): UniformValues<TerrainRasterUniformsType> => ({
    'u_matrix': matrix,
    'u_lighting_matrix': lightingMatrix,
    'u_image0': 0,
    'u_cubemap': 1,
    'u_opacity': skyUniforms['u_opacity'],
    'u_skirt_height': skirtHeight,
    'u_near': near,
    'u_far': far,
    'u_fog_start': fogStart,
    'u_fog_end': fogEnd,
    'u_fog_intensity': fogIntensity,
    'u_fog_color': fogColor,
    'u_fog_blend': skyUniforms['u_fog_blend'],
    'u_sun_direction': skyUniforms['u_sun_direction'],
    'u_temporal_offset': skyUniforms['u_temporal_offset']
});

export {terrainRasterUniforms, terrainRasterUniformValues};
