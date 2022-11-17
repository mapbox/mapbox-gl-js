attribute vec2 a_pos;

uniform mat4 u_matrix;

#ifdef LIGHTING_3D_MODE
uniform vec4 u_color;
varying vec4 v_color;
#endif

void main() {
    gl_Position = u_matrix * vec4(a_pos, 0, 1);

#ifdef LIGHTING_3D_MODE
    v_color = apply_lighting(u_color);
#endif
#ifdef FOG
    v_fog_pos = fog_position(a_pos);
#endif
}
