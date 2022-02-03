// @flow

import type Color from '../../style-spec/util/color.js';

import {
    UniformMatrix3f,
    Uniform1f,
    Uniform3f,
    Uniform4f,
} from '../uniform_binding.js';
import type {
    UniformValues,
    UniformLocations,
} from '../uniform_binding.js';
import type Context from '../../gl/context.js';

export type SkyboxCaptureUniformsType = {|
    'u_matrix_3f': UniformMatrix3f,
    'u_sun_direction': Uniform3f,
    'u_sun_intensity': Uniform1f,
    'u_color_tint_r': Uniform4f,
    'u_color_tint_m': Uniform4f,
    'u_luminance': Uniform1f,
|};

const skyboxCaptureUniforms = (context: Context, locations: UniformLocations): SkyboxCaptureUniformsType => ({
    'u_matrix_3f': new UniformMatrix3f(context, locations.u_matrix_3f),
    'u_sun_direction': new Uniform3f(context, locations.u_sun_direction),
    'u_sun_intensity': new Uniform1f(context, locations.u_sun_intensity),
    'u_color_tint_r': new Uniform4f(context, locations.u_color_tint_r),
    'u_color_tint_m': new Uniform4f(context, locations.u_color_tint_m),
    'u_luminance': new Uniform1f(context, locations.u_luminance),
});

const skyboxCaptureUniformValues = (
    matrix: Float32Array,
    sunDirection: [number, number, number],
    sunIntensity: number,
    atmosphereColor: Color,
    atmosphereHaloColor: Color
): UniformValues<SkyboxCaptureUniformsType> => ({
    'u_matrix_3f': matrix,
    'u_sun_direction': sunDirection,
    'u_sun_intensity': sunIntensity,
    'u_color_tint_r': [
        atmosphereColor.r,
        atmosphereColor.g,
        atmosphereColor.b,
        atmosphereColor.a
    ],
    'u_color_tint_m': [
        atmosphereHaloColor.r,
        atmosphereHaloColor.g,
        atmosphereHaloColor.b,
        atmosphereHaloColor.a
    ],
    'u_luminance': 5e-5,
});

export {
    skyboxCaptureUniforms,
    skyboxCaptureUniformValues,
};
