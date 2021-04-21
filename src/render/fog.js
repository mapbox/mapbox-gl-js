// @flow

import Context from '../gl/context.js';
import type {UniformLocations} from './uniform_binding.js';

import {Uniform1f, Uniform2f, Uniform3f, Uniform4f, UniformMatrix4f} from './uniform_binding.js';

export type FogUniformsType = {|
    'u_fog_matrix': UniformMatrix4f,
    'u_fog_range': Uniform2f,
    'u_fog_color': Uniform3f,
    'u_fog_exponent': Uniform1f,
    'u_fog_horizon_blend': Uniform1f,
    'u_fog_temporal_offset': Uniform1f,
    'u_haze_color_linear': Uniform4f,

    // Precision may differ, so we must pass uniforms separately for use in a vertex shader
    'u_fog_opacity': Uniform1f,

|};

export const fogUniforms = (context: Context, locations: UniformLocations): FogUniformsType => ({
    'u_fog_matrix': new UniformMatrix4f(context, locations.u_fog_matrix),
    'u_fog_range': new Uniform2f(context, locations.u_fog_range),
    'u_fog_color': new Uniform3f(context, locations.u_fog_color),
    'u_fog_exponent': new Uniform1f(context, locations.u_fog_exponent),
    'u_fog_horizon_blend': new Uniform1f(context, locations.u_fog_horizon_blend),
    'u_fog_temporal_offset': new Uniform1f(context, locations.u_fog_temporal_offset),
    'u_haze_color_linear': new Uniform4f(context, locations.u_haze_color_linear),

    'u_fog_opacity': new Uniform1f(context, locations.u_fog_opacity),
});
