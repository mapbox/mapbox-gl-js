#ifdef FOG

uniform mat4 u_fog_matrix;
uniform mediump float u_fog_horizon_blend;
uniform mediump float u_fog_opacity;
uniform mediump float u_fog_exponent;
uniform mediump vec2 u_fog_range;
uniform mediump vec4 u_haze_color_linear;

// This function much match fog_opacity defined in _prelude_fog.fragment.glsl
float fog_opacity(float t) {
    const float decay = 6.0;
    float falloff = 1.0 - min(1.0, exp(-decay * t));
    falloff *= falloff * falloff;
    return u_fog_opacity * min(1.0, 1.00747 * falloff);
}

// This function much match fog_horizon_blending defined in _prelude_fog.fragment.glsl
float fog_horizon_blending(vec3 camera_dir) {
    float t = max(0.0, camera_dir.z / u_fog_horizon_blend);
    return u_fog_opacity * exp(-3.0 * t * t);
}

vec3 fog_position(vec3 pos) {
    // The following function requires that u_fog_matrix be affine and result in
    // a vector with w = 1. Otherwise we must divide by w.
    return (u_fog_matrix * vec4(pos, 1)).xyz;
}

// Accept either 2D or 3D positions
vec3 fog_position(vec2 pos) {
    return fog_position(vec3(pos, 0));
}

void fog_haze(vec3 pos, out float fog_opac, out vec4 haze) {
    // Map [near, far] to [0, 1]
    float depth = length(pos);
    float t = (depth - u_fog_range.x) / (u_fog_range.y - u_fog_range.x);

    float haze_opac = fog_opacity(t);
    fog_opac = haze_opac * pow(smoothstep(0.0, 1.0, t), u_fog_exponent);
    fog_opac *= fog_horizon_blending(pos / depth);

#ifdef FOG_HAZE
    haze.rgb = haze_opac * u_haze_color_linear.rgb;

    // The smoothstep fades in tonemapping slightly before the fog layer. This violates
    // the principle that fog should not have an effect outside the fog layer, but the
    // effect is hardly noticeable except on pure white glaciers.
    haze.a = u_fog_opacity * u_haze_color_linear.a * smoothstep(-0.5, 0.25, t);
#endif
}

#endif
