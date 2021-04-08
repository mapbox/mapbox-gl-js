#ifdef FOG

uniform float u_vert_fog_opacity;
uniform float u_vert_fog_exponent;
uniform vec2 u_vert_fog_range;
uniform vec4 u_vert_haze_color_linear;
uniform mat4 u_fog_matrix;

// This function much match fog_opacity defined in _prelude_fog.fragment.glsl
float fog_opacity(float t) {
    const float decay = 6.0;
    float falloff = 1.0 - min(1.0, exp(-decay * t));
    falloff *= falloff * falloff;
    return u_vert_fog_opacity * min(1.0, 1.00747 * falloff);
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
    float t = (length(pos) - u_vert_fog_range.x) / (u_vert_fog_range.y - u_vert_fog_range.x);

    float haze_opac = fog_opacity(t);
    fog_opac = haze_opac * pow(smoothstep(0.0, 1.0, t), u_vert_fog_exponent);

#ifdef FOG_HAZE
    haze.rgb = (haze_opac * u_vert_haze_color_linear.a) * u_vert_haze_color_linear.rgb;

    // The smoothstep fades in tonemapping slightly before the fog layer. This violates
    // the principle that fog should not have an effect outside the fog layer, but the
    // effect is hardly noticeable except on pure white glaciers.
    haze.a = u_vert_fog_opacity * min(1.0, u_vert_haze_color_linear.a) * smoothstep(-0.5, 0.25, t);
#endif
}

#endif
