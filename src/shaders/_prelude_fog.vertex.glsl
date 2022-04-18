#ifdef FOG

uniform mediump vec4 u_fog_color;
uniform mediump vec2 u_fog_range;
uniform mediump float u_fog_horizon_blend;
uniform mediump mat4 u_fog_matrix;
varying vec3 v_fog_pos;

vec3 fog_position(vec3 pos) {
    // The following function requires that u_fog_matrix be affine and
    // results in a vector with w = 1. Otherwise we must divide by w.
    return (u_fog_matrix * vec4(pos, 1.0)).xyz;
}

vec3 fog_position(vec2 pos) {
    return fog_position(vec3(pos, 0.0));
}

float fog(vec3 pos) {
    float depth = length(pos);
    float opacity = fog_opacity(u_fog_color, fog_range(u_fog_range, depth));
    return opacity * fog_horizon_blending(u_fog_color, u_fog_horizon_blend, pos / depth);
}

#endif
