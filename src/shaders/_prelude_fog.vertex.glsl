#ifdef FOG

uniform mat4 u_cam_matrix;

vec3 fog_position(vec3 pos) {
    // The following function requires that u_cam_matrix be affine and result in
    // a vector with w = 1. Otherwise we must divide by w.
    return (u_cam_matrix * vec4(pos, 1)).xyz;
}

// Accept either 2D or 3D positions
vec3 fog_position(vec2 pos) {
    return fog_position(vec3(pos, 0));
}

#endif
