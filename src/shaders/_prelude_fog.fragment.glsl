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
    return mix(u_fog_color, sky_color, fog_falloff);
}

vec3 fog_apply(vec3 color, float depth) {
    float start = u_fog_range.x;
    float end = u_fog_range.y;
    // Apply a constant to push the function closer to 1.0 on the far end
    // of the fog range, refer https://www.desmos.com/calculator/x5gopnb91a
    float exp_constant = 5.5;
    float fog_falloff = exp(-exp_constant * (depth - start) / (end - start));
    fog_falloff = 1.0 - clamp(fog_falloff, 0.0, 1.0);
    return mix(color, u_fog_color, fog_falloff * u_fog_opacity);
}

#else

vec3 fog_apply(vec3 color, float depth) {
    return color;
}

vec3 fog_apply_sky_gradient(vec3 cubemap_uv, vec3 sky_color) {
    return sky_color;
}

#endif