#ifdef FOG

uniform vec2 u_fog_range;
uniform vec3 u_fog_color;
uniform float u_fog_opacity;
uniform float u_fog_sky_blend;
uniform float u_fog_temporal_offset;

vec3 fog_apply_sky_gradient(vec3 cubemap_uv, vec3 sky_color) {
    vec3 camera_ray = normalize(cubemap_uv);
    vec3 y_up = vec3(0.0, 1.0, 0.0);
    float y_blend = dot(camera_ray, y_up);
    float gradient = smoothstep(0.0, u_fog_sky_blend, y_blend);
    float fog_falloff = clamp(gradient + (1.0 - u_fog_opacity), 0.0, 1.0);

    // We may or may not wish to use gamma-correct blending
    return gamma_mix(u_fog_color, sky_color, fog_falloff);
}

float fog_opacity(vec3 position) {
    float depth = length(position);
    float start = u_fog_range.x;
    float end = u_fog_range.y;

    // Fog falls off exponentially, but it also doesn't start at an arbitrary
    // distance. So we opt for a sigmoid function that results in a very smooth
    // onset. See: https://www.desmos.com/calculator/boumcg1dwo
    // Fog power puts the fog at about 0.6% and 99.4% at near and far, respectively
    // The multiplier puts the far limit at 1.0 since clipping depends on that
    const float fog_pow = 10.0;
    float fog_falloff = min(1.0, 1.00675 / (1.0 + exp(-fog_pow * ((depth - start) / (end - start) - 0.5))));

    return fog_falloff * u_fog_opacity;
}

vec3 fog_apply(vec3 color, vec3 position) {
    return mix(color, u_fog_color, fog_opacity(position));
}

vec3 fog_dither(vec3 color) {
    return dither(color, gl_FragCoord.xy + u_fog_temporal_offset);
}

vec4 fog_dither(vec4 color) {
    return vec4(fog_dither(color.rgb), color.a);
}

// Un-premultiply the alpha, then blend fog, then re-premultiply alpha. For
// use with colors using premultiplied alpha
vec4 fog_apply_premultiplied(vec4 color, vec3 position) {
    float a = 1e-4 + color.a;
    return vec4(fog_apply(min(color.rgb / a, vec3(1)), position) * a, color.a);
}

#endif
