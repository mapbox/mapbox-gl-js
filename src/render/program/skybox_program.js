// @flow

import {
    UniformMatrix4f,
    Uniform1i,
    Uniform3f,
    Uniform1f
} from '../uniform_binding.js';
import {degToRad} from '../../util/util.js';

import type {UniformValues} from '../uniform_binding.js';
import type Context from '../../gl/context.js';

export type SkyboxUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_sun_direction': Uniform3f,
    'u_cubemap': Uniform1i,
    'u_opacity': Uniform1f,
    'u_temporal_offset': Uniform1f
|};

export type SkyboxGradientlUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_color_ramp': Uniform1i,
    'u_center_direction': Uniform3f,
    'u_radius': Uniform1f,
    'u_opacity': Uniform1f,
    'u_temporal_offset': Uniform1f,
|};

const skyboxUniforms = (context: Context): SkyboxUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_sun_direction': new Uniform3f(context),
    'u_cubemap': new Uniform1i(context),
    'u_opacity': new Uniform1f(context),
    'u_temporal_offset': new Uniform1f(context)

});

const skyboxUniformValues = (
    matrix: Float32Array,
    sunDirection: [number, number, number],
    cubemap: number,
    opacity: number,
    temporalOffset: number
): UniformValues<SkyboxUniformsType> => ({
    'u_matrix': matrix,
    'u_sun_direction': sunDirection,
    'u_cubemap': cubemap,
    'u_opacity': opacity,
    'u_temporal_offset': temporalOffset
});

const skyboxGradientUniforms = (context: Context): SkyboxGradientlUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_color_ramp': new Uniform1i(context),
    // radial gradient uniforms
    'u_center_direction': new Uniform3f(context),
    'u_radius': new Uniform1f(context),
    'u_opacity': new Uniform1f(context),
    'u_temporal_offset': new Uniform1f(context)
});

const skyboxGradientUniformValues = (
    matrix: Float32Array,
    centerDirection: [number, number, number],
    radius: number, //degrees
    opacity: number,
    temporalOffset: number
): UniformValues<SkyboxGradientlUniformsType> => {
    return {
        'u_matrix': matrix,
        'u_color_ramp': 0,
        'u_center_direction': centerDirection,
        'u_radius': degToRad(radius),
        'u_opacity': opacity,
        'u_temporal_offset': temporalOffset
    };
};

export {
    skyboxUniforms,
    skyboxUniformValues,
    skyboxGradientUniforms,
    skyboxGradientUniformValues
};
