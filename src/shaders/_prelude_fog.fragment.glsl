#ifdef FOG

uniform vec3 u_fog_color;
uniform float u_fog_temporal_offset;

// This function is only used in rare places like heatmap where opacity is used
// directly, outside the normal fog_apply method.
float fog_opacity(vec3 pos) {
    return fog_opacity(fog_range(length(pos)));
}

vec3 fog_apply(vec3 color, vec3 pos) {
    float depth = length(pos);
    float t = fog_range(depth);
    float fog_opac = fog_opacity(t) * fog_horizon_blending(pos / depth);

    return mix(color, u_fog_color, fog_opac);
}

// Apply fog computed in the vertex shader
vec3 fog_apply_from_vert(vec3 color, float fog_opac) {
    return mix(color, u_fog_color, fog_opac);
}

// Assumes z up
vec3 fog_apply_sky_gradient(vec3 camera_ray, vec3 sky_color) {
    return mix(sky_color, u_fog_color, fog_horizon_blending(normalize(camera_ray)));
}

// Un-premultiply the alpha, then blend fog, then re-premultiply alpha. For
// use with colors using premultiplied alpha
vec4 fog_apply_premultiplied(vec4 color, vec3 pos) {
    float a = 1e-4 + color.a;
    return vec4(fog_apply(min(color.rgb / a, vec3(1)), pos) * a, color.a);
}

vec3 fog_dither(vec3 color) {
    return dither(color, gl_FragCoord.xy + u_fog_temporal_offset);
}

vec4 fog_dither(vec4 color) {
    return vec4(fog_dither(color.rgb), color.a);
}

#endif
