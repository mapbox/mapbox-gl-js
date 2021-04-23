#ifdef FOG

uniform vec3 u_fog_color;
uniform float u_fog_temporal_offset;
uniform mediump vec3 u_haze_color_linear;
uniform mediump float u_fog_exponent;

// This function is only used in rare places like heatmap where opacity is used
// directly, outside the normal fog_apply method.
float fog_opacity(vec3 pos) {
    return fog_opacity(fog_range(length(pos)));
}

// This function applies haze to an input color using an approximation of the following algorithm:
//   1. convert color from sRGB to linear RGB
//   2. add haze (presuming haze is in linear RGB)
//   3. tone-map the output
//   4. convert the result back to sRGB
// The equation below is based on a curve fit of the above algorithm, with the additional approximation
// during linear-srgb conversion that gamma=2, in order to avoid transcendental function evaluations
// which don't affect the visual quality.
vec3 haze_apply(vec3 color, vec3 haze) {
    vec3 color2 = color * color;
    return sqrt((color2 + haze) / (1.0 + color2 * color * haze));
}

vec3 fog_apply(vec3 color, vec3 pos) {
    float depth = length(pos);
    float t = fog_range(depth);

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
