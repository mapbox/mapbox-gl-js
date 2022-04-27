uniform mat4 u_matrix;
uniform mat4 u_light_matrix_0;
uniform mat4 u_light_matrix_1;

attribute vec2 a_pos;
attribute vec2 a_texture_pos;

varying vec2 v_uv;
varying vec4 v_pos_light_view_0;
varying vec4 v_pos_light_view_1;
varying float v_depth;

void main() {
    gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
    v_uv = a_texture_pos / 8192.0;

    v_pos_light_view_0 = u_light_matrix_0 * vec4(a_pos, 0.0, 1.0);
    v_pos_light_view_1 = u_light_matrix_1 * vec4(a_pos, 0.0, 1.0);

    v_depth = gl_Position.w;
}
