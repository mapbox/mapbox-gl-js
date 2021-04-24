attribute vec2 a_pos;

uniform mat4 u_matrix;

#ifdef FOG_OR_HAZE
varying vec3 v_fog_pos;
#endif

void main() {
    gl_Position = u_matrix * vec4(a_pos, 0, 1);

#ifdef FOG_OR_HAZE
    v_fog_pos = fog_position(a_pos);
#endif
}
