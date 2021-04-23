#ifdef FOG

uniform mat4 u_fog_matrix;
uniform mediump float u_fog_exponent;

vec3 fog_position(vec3 pos) {
    // The following function requires that u_fog_matrix be affine and result in
    // a vector with w = 1. Otherwise we must divide by w.
    return (u_fog_matrix * vec4(pos, 1)).xyz;
}

// Accept either 2D or 3D positions
vec3 fog_position(vec2 pos) {
    return fog_position(vec3(pos, 0));
}

void fog(vec3 pos, out float fog_opac) {
    float depth = length(pos);
    float t = fog_range(depth);
    fog_opac = fog_opacity(t) * pow(smoothstep(0.0, 1.0, t), u_fog_exponent);
    fog_opac *= fog_horizon_blending(pos / depth);
}

#endif
