#ifdef FOG_OR_HAZE

uniform mat4 u_fog_matrix;

vec3 fog_position(vec3 pos) {
    // The following function requires that u_fog_matrix be affine and result in
    // a vector with w = 1. Otherwise we must divide by w.
    return (u_fog_matrix * vec4(pos, 1)).xyz;
}

// Accept either 2D or 3D positions
vec3 fog_position(vec2 pos) {
    return fog_position(vec3(pos, 0));
}

#endif

#ifdef FOG

float fog(vec3 pos) {
    float depth = length(pos);
    float opacity = fog_opacity(fog_range(depth));
    return opacity * fog_horizon_blending(pos / depth);
}

#endif

#ifdef HAZE

float haze(vec3 pos) {
    float depth = length(pos);
    return haze_opacity(haze_range(depth));
}

#endif
