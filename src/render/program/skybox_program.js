// @flow

import {
    UniformMatrix4f,
    Uniform1i,
    Uniform3f,
    Uniform1f
} from '../uniform_binding';
import {vec3} from 'gl-matrix';
import {degToRad} from '../../util/util';

import type {UniformValues, UniformLocations} from '../uniform_binding';
import type Context from '../../gl/context';

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

const skyboxUniforms = (context: Context, locations: UniformLocations): SkyboxUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_sun_direction': new Uniform3f(context, locations.u_sun_direction),
    'u_cubemap': new Uniform1i(context, locations.u_cubemap),
    'u_opacity': new Uniform1f(context, locations.u_opacity),
    'u_temporal_offset': new Uniform1f(context, locations.u_temporal_offset)

});

const skyboxUniformValues = (
    matrix: Float32Array,
    sunDirection: vec3,
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

const skyboxGradientUniforms = (context: Context, locations: UniformLocations): SkyboxGradientlUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_color_ramp': new Uniform1i(context, locations.u_color_ramp),
    // radial gradient uniforms
    'u_center_direction': new Uniform3f(context, locations.u_center_direction),
    'u_radius': new Uniform1f(context, locations.u_radius),
    'u_opacity': new Uniform1f(context, locations.u_opacity),
    'u_temporal_offset': new Uniform1f(context, locations.u_temporal_offset)
});

const skyboxGradientUniformValues = (
    matrix: Float32Array,
    centerDirection: vec3,
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
