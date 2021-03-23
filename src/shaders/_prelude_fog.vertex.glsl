#ifdef FOG

uniform mat4 u_cam_matrix;

vec3 fog_position(vec3 pos) {
    vec4 p = u_cam_matrix * vec4(pos, 1);
    return p.xyz / p.w;
}

// Accept either 2D or 3D positions
vec3 fog_position(vec2 pos) {
    return fog_position(vec3(pos, 0));
}

#endif
