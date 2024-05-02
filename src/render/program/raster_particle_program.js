// @flow

import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform4f,
    UniformMatrix3f,
    UniformMatrix4f
} from '../uniform_binding.js';
import {PARTICLE_POS_SCALE, PARTICLE_POS_OFFSET} from '../raster_particle_state.js';

import type Context from '../../gl/context.js';
import type {UniformValues} from '../uniform_binding.js';

export type RasterParticleUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_normalize_matrix': UniformMatrix4f,
    'u_globe_matrix': UniformMatrix4f,
    'u_merc_matrix': UniformMatrix4f,
    'u_grid_matrix': UniformMatrix3f,
    'u_tl_parent': Uniform2f,
    'u_scale_parent': Uniform1f,
    'u_fade_t': Uniform1f,
    'u_opacity': Uniform1f,
    'u_image0': Uniform1i,
    'u_image1': Uniform1i,
    'u_raster_elevation': Uniform1f,
    'u_zoom_transition': Uniform1f,
    'u_merc_center': Uniform2f,
    'u_cutoff_params': Uniform4f
|};

export type RasterParticleDefinesType = 'RASTER_ARRAY' | 'RENDER_CUTOFF' | 'DATA_FORMAT_UINT32' | 'DATA_FORMAT_UINT16' | 'DATA_FORMAT_UINT8';

const rasterParticleUniforms = (context: Context): RasterParticleUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_normalize_matrix': new UniformMatrix4f(context),
    'u_globe_matrix': new UniformMatrix4f(context),
    'u_merc_matrix': new UniformMatrix4f(context),
    'u_grid_matrix': new UniformMatrix3f(context),
    'u_tl_parent': new Uniform2f(context),
    'u_scale_parent': new Uniform1f(context),
    'u_fade_t': new Uniform1f(context),
    'u_opacity': new Uniform1f(context),
    'u_image0': new Uniform1i(context),
    'u_image1': new Uniform1i(context),
    'u_raster_elevation': new Uniform1f(context),
    'u_zoom_transition': new Uniform1f(context),
    'u_merc_center': new Uniform2f(context),
    'u_cutoff_params': new Uniform4f(context)
});

const rasterParticleUniformValues = (
    matrix: Float32Array,
    normalizeMatrix: Float32Array,
    globeMatrix: Float32Array,
    mercMatrix: Float32Array,
    gridMatrix: Float32Array,
    parentTL: [number, number],
    zoomTransition: number,
    mercatorCenter: [number, number],
    cutoffParams: [number, number, number, number],
    parentScaleBy: number,
    fade: {mix: number, opacity: number},
    elevation: number
): UniformValues<RasterParticleUniformsType> => ({
    'u_matrix': matrix,
    'u_normalize_matrix': normalizeMatrix,
    'u_globe_matrix': globeMatrix,
    'u_merc_matrix': mercMatrix,
    'u_grid_matrix': gridMatrix,
    'u_tl_parent': parentTL,
    'u_scale_parent': parentScaleBy,
    'u_fade_t': fade.mix,
    'u_opacity': fade.opacity,
    'u_image0': 0,
    'u_image1': 1,
    'u_raster_elevation': elevation,
    'u_zoom_transition': zoomTransition,
    'u_merc_center': mercatorCenter,
    'u_cutoff_params': cutoffParams
});

export type RasterParticleTextureUniforms = {|
    'u_texture': Uniform1i,
    'u_opacity': Uniform1f
|};

const rasterParticleTextureUniforms = (context: Context): RasterParticleTextureUniforms => ({
    'u_texture': new Uniform1i(context),
    'u_opacity': new Uniform1f(context)
});

const rasterParticleTextureUniformValues = (
    textureUnit: number,
    opacity: number
): UniformValues<RasterParticleTextureUniforms> => ({
    'u_texture': textureUnit,
    'u_opacity': opacity
});

export type RasterParticleDrawUniformsType = {|
    'u_particle_texture': Uniform1i,
    'u_particle_texture_side_len': Uniform1f,
    'u_tile_offset': Uniform2f,
    'u_velocity': Uniform1i,
    'u_color_ramp': Uniform1i,
    'u_velocity_res': Uniform2f,
    'u_max_speed': Uniform1f,
    'u_uv_offset': Uniform2f,
    'u_data_scale': Uniform4f,
    'u_data_offset': Uniform1f,
    'u_particle_pos_scale': Uniform1f,
    'u_particle_pos_offset': Uniform2f
|};

const rasterParticleDrawUniforms = (context: Context): RasterParticleDrawUniformsType => ({
    'u_particle_texture': new Uniform1i(context),
    'u_particle_texture_side_len': new Uniform1f(context),
    'u_tile_offset': new Uniform2f(context),
    'u_velocity': new Uniform1i(context),
    'u_color_ramp': new Uniform1i(context),
    'u_velocity_res': new Uniform2f(context),
    'u_max_speed': new Uniform1f(context),
    'u_uv_offset': new Uniform2f(context),
    'u_data_scale': new Uniform4f(context),
    'u_data_offset': new Uniform1f(context),
    'u_particle_pos_scale': new Uniform1f(context),
    'u_particle_pos_offset': new Uniform2f(context)
});

const rasterParticleDrawUniformValues = (particleTextureUnit: number, particleTextureSideLen: number, tileOffset: [number, number], velocityTextureUnit: number, velocityTextureSize: [number, number], colorRampUnit: number, maxSpeed: number, textureOffset: [number, number], dataScale: [number, number, number, number], dataOffset: number): UniformValues<RasterParticleDrawUniformsType> => ({
    'u_particle_texture': particleTextureUnit,
    'u_particle_texture_side_len': particleTextureSideLen,
    'u_tile_offset': tileOffset,
    'u_velocity': velocityTextureUnit,
    'u_color_ramp': colorRampUnit,
    'u_velocity_res': velocityTextureSize,
    'u_max_speed': maxSpeed,
    'u_uv_offset': textureOffset,
    'u_data_scale': dataScale,
    'u_data_offset': dataOffset,
    'u_particle_pos_scale': PARTICLE_POS_SCALE,
    'u_particle_pos_offset': [PARTICLE_POS_OFFSET, PARTICLE_POS_OFFSET]
});

export type RasterParticleUpdateUniformsType = {|
    'u_particle_texture': Uniform1i,
    'u_particle_texture_side_len': Uniform1f,
    'u_velocity': Uniform1i,
    'u_velocity_res': Uniform2f,
    'u_max_speed': Uniform1f,
    'u_speed_factor': Uniform1f,
    'u_reset_rate': Uniform1f,
    'u_rand_seed': Uniform1f,
    'u_uv_offset': Uniform2f,
    'u_data_scale': Uniform4f,
    'u_data_offset': Uniform1f,
    'u_particle_pos_scale': Uniform1f,
    'u_particle_pos_offset': Uniform2f
|};

const rasterParticleUpdateUniforms = (context: Context): RasterParticleUpdateUniformsType => ({
    'u_particle_texture': new Uniform1i(context),
    'u_particle_texture_side_len': new Uniform1f(context),
    'u_velocity': new Uniform1i(context),
    'u_velocity_res': new Uniform2f(context),
    'u_max_speed': new Uniform1f(context),
    'u_speed_factor': new Uniform1f(context),
    'u_reset_rate': new Uniform1f(context),
    'u_rand_seed': new Uniform1f(context),
    'u_uv_offset': new Uniform2f(context),
    'u_data_scale': new Uniform4f(context),
    'u_data_offset': new Uniform1f(context),
    'u_particle_pos_scale': new Uniform1f(context),
    'u_particle_pos_offset': new Uniform2f(context)
});

const rasterParticleUpdateUniformValues = (particleTextureUnit: number, particleTextureSideLen: number, velocityTextureUnit: number, velocityTextureSize: [number, number], maxSpeed: number, speedFactor: number, resetRate: number, textureOffset: [number, number], dataScale: [number, number, number, number], dataOffset: number): UniformValues<RasterParticleUpdateUniformsType> => ({
    'u_particle_texture': particleTextureUnit,
    'u_particle_texture_side_len': particleTextureSideLen,
    'u_velocity': velocityTextureUnit,
    'u_velocity_res': velocityTextureSize,
    'u_max_speed': maxSpeed,
    'u_speed_factor': speedFactor,
    'u_reset_rate': resetRate,
    'u_rand_seed': Math.random(),
    'u_uv_offset': textureOffset,
    'u_data_scale': dataScale,
    'u_data_offset': dataOffset,
    'u_particle_pos_scale': PARTICLE_POS_SCALE,
    'u_particle_pos_offset': [PARTICLE_POS_OFFSET, PARTICLE_POS_OFFSET]
});

export {rasterParticleUniforms, rasterParticleUniformValues, rasterParticleTextureUniforms, rasterParticleTextureUniformValues, rasterParticleDrawUniforms, rasterParticleDrawUniformValues, rasterParticleUpdateUniforms, rasterParticleUpdateUniformValues};
