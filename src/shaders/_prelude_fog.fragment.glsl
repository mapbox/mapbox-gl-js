#ifdef FOG

uniform vec3 u_fog_color;
uniform float u_fog_temporal_offset;
uniform mediump float u_fog_horizon_blend;
uniform mediump vec2 u_fog_range;
uniform mediump float u_fog_opacity;
uniform mediump vec3 u_haze_color_linear;
uniform mediump float u_fog_exponent;

// Assumes z up and camera_dir *normalized* (to avoid computing its length multiple
// times for different functions).
// Must match definitions in:
// src/shaders/_prelude_fog.vertex.glsl#fog_horizon_blending
// src/style/fog_helpers.js#getFogSkyBlending
float fog_horizon_blending(vec3 camera_dir) {
    float t = max(0.0, camera_dir.z / u_fog_horizon_blend);
    // Factor of 3 chosen to roughly match smoothstep.
    // See: https://www.desmos.com/calculator/pub31lvshf
    return u_fog_opacity * exp(-3.0 * t * t);
}

// Computes the fog opacity when fog strength = 1. Otherwise it's multiplied
// by a smoothstep to a power to decrease the amount of fog relative to haze.
//   - t: depth, rescaled to 0 at fogStart and 1 at fogEnd
// See: https://www.desmos.com/calculator/3taufutxid
// This function much match src/style/fog.js and _prelude_fog.vertex.glsl
float fog_opacity(float t) {
    const float decay = 6.0;
    float falloff = 1.0 - min(1.0, exp(-decay * t));

    // Cube without pow()
    falloff *= falloff * falloff;

    // Scale and clip to 1 at the far limit
    return u_fog_opacity * min(1.0, 1.00747 * falloff);
}

// This function is only used in rare places like heatmap where opacity is used
// directly, outside the normal fog_apply method.
float fog_opacity(vec3 pos) {
    return fog_opacity((length(pos) - u_fog_range.x) / (u_fog_range.y - u_fog_range.x));
}

vec3 haze_apply(vec3 color, vec3 haze) {
    vec3 color2 = color * color;
    return sqrt((color2 + haze) / (1.0 + color2 * color2 * haze));
}

vec3 fog_apply(vec3 color, vec3 pos) {
    // Map [near, far] to [0, 1]
    float depth = length(pos);
    float t = (depth - u_fog_range.x) / (u_fog_range.y - u_fog_range.x);

    float haze_opac = fog_opacity(t);
    float fog_opac = haze_opac * pow(smoothstep(0.0, 1.0, t), u_fog_exponent);
    fog_opac *= fog_horizon_blending(pos / depth);

#ifdef FOG_HAZE
    color = haze_apply(color, haze_opac * u_haze_color_linear);
#endif

    return mix(color, u_fog_color, fog_opac);
}

// Apply fog and haze which were computed in the vertex shader
vec3 fog_apply_from_vert(vec3 color, float fog_opac, vec3 haze) {
#ifdef FOG_HAZE
    color = haze_apply(color, haze);
#endif

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
