import Context from '../../src/gl/context';
import {Uniform1f, Uniform1i, Uniform2f, Uniform3f, UniformMatrix4f} from '../../src/render/uniform_binding';
import type {UniformValues} from '../../src/render/uniform_binding';

export type ShadowUniformsType = {
    ['u_light_matrix_0']: UniformMatrix4f;
    ['u_light_matrix_1']: UniformMatrix4f;
    ['u_shadow_intensity']: Uniform1f;
    ['u_fade_range']: Uniform2f;
    ['u_shadow_normal_offset']: Uniform3f // [tileToMeter, offsetCascade0, offsetCascade1];
    ['u_shadow_texel_size']: Uniform1f;
    ['u_shadow_map_resolution']: Uniform1f;
    ['u_shadow_direction']: Uniform3f;
    ['u_shadow_bias']: Uniform3f;
    ['u_shadowmap_0']: Uniform1i;
    ['u_shadowmap_1']: Uniform1i;
};

export const shadowUniforms = (context: Context): ShadowUniformsType => ({
    'u_light_matrix_0': new UniformMatrix4f(context),
    'u_light_matrix_1': new UniformMatrix4f(context),
    'u_fade_range': new Uniform2f(context),
    'u_shadow_normal_offset': new Uniform3f(context),
    'u_shadow_intensity': new Uniform1f(context),
    'u_shadow_texel_size': new Uniform1f(context),
    'u_shadow_map_resolution': new Uniform1f(context),
    'u_shadow_direction': new Uniform3f(context),
    'u_shadow_bias': new Uniform3f(context),
    'u_shadowmap_0': new Uniform1i(context),
    'u_shadowmap_1': new Uniform1i(context)
});

export function defaultShadowUniformValues(): UniformValues<ShadowUniformsType> {
    return {
        'u_light_matrix_0': new Float32Array(16),
        'u_light_matrix_1': new Float32Array(16),
        'u_shadow_intensity': 0.0,
        'u_fade_range': [0.0, 0.0],
        'u_shadow_normal_offset': [1.0, 1.0, 1.0],
        'u_shadow_texel_size': 1.0,
        'u_shadow_map_resolution': 1.0,
        'u_shadow_direction': [0.0, 0.0, 1.0],
        'u_shadow_bias': [0.00036, 0.0012, 0.012],
        'u_shadowmap_0': 0,
        'u_shadowmap_1': 0
    };
}
