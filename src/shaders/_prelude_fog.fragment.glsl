#ifdef FOG_OR_HAZE

uniform float u_fog_temporal_offset;

vec3 fog_dither(vec3 color) {
    return dither(color, gl_FragCoord.xy + u_fog_temporal_offset);
}

vec4 fog_dither(vec4 color) {
    return vec4(fog_dither(color.rgb), color.a);
}

#endif

#ifdef FOG

uniform vec3 u_fog_color;

// This function is only used in rare places like heatmap where opacity is used
// directly, outside the normal fog_apply method.
float fog_opacity(vec3 pos) {
    return fog_opacity(fog_range(length(pos)));
}

// Assumes z up
vec3 fog_apply_sky_gradient(vec3 camera_ray, vec3 sky_color) {
    return mix(sky_color, u_fog_color, fog_horizon_blending(normalize(camera_ray)));
}

// Apply fog computed in the vertex shader
vec3 fog_apply_from_computed(vec3 color, float opac) {
    return mix(color, u_fog_color, opac);
}

#endif

#ifdef HAZE
uniform vec3 u_haze_color_linear;

const float gamma = 2.2;

vec3 tonemap (vec3 color) {
    const float k = 8.0;
    return -log2(exp2(-k * color) + exp2(-k)) * (1.0 / k);
}

// Apply fog computed in the vertex shader
vec3 haze_apply_from_computed(vec3 color, float opac) {
    color = pow(color, vec3(gamma));

    color += opac * u_haze_color_linear;

    color = tonemap(color);

    return pow(color, vec3(1.0 / gamma));
}

#endif

#ifdef FOG_OR_HAZE
vec3 fog_haze_apply(vec3 color, vec3 pos) {
    float depth = length(pos);

#ifdef FOG
    float opac = fog_opacity(fog_range(depth)) * fog_horizon_blending(pos / depth);
    color = fog_apply_from_computed(color, opac);
#endif

#ifdef HAZE
    color = haze_apply_from_computed(color, haze_opacity(haze_range(depth)));
#endif

    return color;
}

// Un-premultiply the alpha, then blend fog, then re-premultiply alpha. For
// use with colors using premultiplied alpha
vec4 fog_haze_apply_premultiplied(vec4 color, vec3 pos) {
    float a = 1e-4 + color.a;
    return vec4(fog_haze_apply(min(color.rgb / a, vec3(1)), pos) * a, color.a);
}
#endif
