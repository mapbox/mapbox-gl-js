uniform mat4 u_matrix;

attribute vec2 a_pos;
attribute vec2 a_texture_pos;

varying vec2 v_pos;

#ifdef FOG_OR_HAZE
varying vec3 v_fog_pos;
#endif

void main() {
    gl_Position = u_matrix * vec4(a_pos, 0, 1);
    v_pos = a_texture_pos / 8192.0;

#ifdef FOG_OR_HAZE
    v_fog_pos = fog_position(a_pos);
#endif
}
