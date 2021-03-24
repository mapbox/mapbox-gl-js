#ifdef FOG

uniform vec2 u_fog_range;
uniform vec3 u_fog_color;
uniform float u_fog_opacity;
uniform float u_fog_sky_blend;

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

    // Apply a constant to push the function closer to 1.0 on the far end
    // of the fog range, refer https://www.desmos.com/calculator/x5gopnb91a
    const float exp_constant = 5.5;
    float fog_falloff = exp(-exp_constant * (depth - start) / (end - start));

    // Apply a power remove the C1 discontinuity at the near limit
    const float fog_power = 2.0;
    float fog_opacity = pow(max((1.0 - fog_falloff) * u_fog_opacity, 0.0), fog_power);

    // Clip to actually return 100% opacity at end
    return min(1.0, fog_opacity * 1.02);
}

vec3 fog_apply(vec3 color, vec3 position) {
    // We may or may not wish to use gamma-correct blending
    return gamma_mix(color, u_fog_color, fog_opacity(position));
}

// Un-premultiply the alpha, then blend fog, then re-premultiply alpha. For
// use with colors using premultiplied alpha
vec4 fog_apply_premultiplied(vec4 color, vec3 position) {
    float a = 1e-4 + color.a;
    return vec4(fog_apply(min(color.rgb / a, vec3(1)), position) * a, color.a);
}

#endif
