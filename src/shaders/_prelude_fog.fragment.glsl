#ifdef FOG

uniform vec2 u_fog_range;
uniform vec3 u_fog_color;
uniform float u_fog_opacity;
uniform float u_fog_sky_blend;

vec3 fog_sky_gradient(vec3 cubemap_uv, vec3 sky_color) {
    vec3 camera_ray = normalize(cubemap_uv);
    vec3 y_up = vec3(0.0, 1.0, 0.0);
    float y_blend = dot(camera_ray, y_up);
    float gradient = smoothstep(0.0, u_fog_sky_blend, y_blend);
    float fog_falloff = clamp(gradient + (1.0 - u_fog_opacity), 0.0, 1.0);
    return mix(u_fog_color, sky_color, fog_falloff);
}

vec3 fog_color() {
    return u_fog_color;
}

#else

vec3 fog_color() {
    return vec3(0.0);
}

vec3 fog_sky_gradient(vec3 cubemap_uv, vec3 sky_color) {
    return sky_color;
}

#endif