#ifdef FOG

uniform float u_fog_temporal_offset;

// This function is only used in rare places like heatmap where opacity is used
// directly, outside the normal fog_apply method.
float fog_opacity(vec3 pos) {
    float depth = length(pos);
    return fog_opacity(fog_range(depth));
}

vec3 fog_apply(vec3 color, vec3 pos) {
    float depth = length(pos);
    float opacity = fog_opacity(fog_range(depth));
    opacity *= fog_horizon_blending(pos / depth);
    return mix(color, u_fog_color.rgb, opacity);
}

// Apply fog computed in the vertex shader
vec4 fog_apply_from_vert(vec4 color, float fog_opac) {
    float alpha = EPSILON + color.a;
    color.rgb = mix(color.rgb / alpha, u_fog_color.rgb, fog_opac) * alpha;
    return color;
}

// Assumes z up
vec3 fog_apply_sky_gradient(vec3 camera_ray, vec3 sky_color) {
    float horizon_blend = fog_horizon_blending(normalize(camera_ray));
    return mix(sky_color, u_fog_color.rgb, horizon_blend);
}

// Un-premultiply the alpha, then blend fog, then re-premultiply alpha.
// For use with colors using premultiplied alpha
vec4 fog_apply_premultiplied(vec4 color, vec3 pos) {
    float alpha = EPSILON + color.a;
    color.rgb = fog_apply(color.rgb / alpha, pos) * alpha;
    return color;
}

vec3 fog_dither(vec3 color) {
    vec2 dither_seed = gl_FragCoord.xy + u_fog_temporal_offset;
    return dither(color, dither_seed);
}

vec4 fog_dither(vec4 color) {
    return vec4(fog_dither(color.rgb), color.a);
}

#endif
