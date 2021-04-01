uniform mat4 u_matrix;
attribute vec2 a_pos;
attribute vec2 a_texture_pos;

varying float v_depth;

#ifdef FOG
varying vec3 v_fog_pos;
#endif


void main() {
    float elevation = elevation(a_texture_pos);
    vec3 pos = vec3(a_pos, elevation);
    gl_Position = u_matrix * vec4(pos, 1.0);
    v_depth = gl_Position.z / gl_Position.w;

    #ifdef FOG
        v_fog_pos = fog_position(pos);
    #endif
}
