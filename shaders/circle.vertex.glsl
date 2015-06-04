// set by gl_util
uniform float u_size;

attribute vec2 a_pos;
attribute vec2 a_extrude;

uniform mat4 u_matrix;
uniform mat4 u_exmatrix;

varying vec4 v_centerpoint;

void main(void) {
    vec4 extrude = u_exmatrix * vec4(a_extrude * u_size, 0, 0);
    // v_centerpoint = u_matrix * vec4(a_pos, 0, 1);
    v_centerpoint = u_matrix * vec4(a_pos, 0, 1);
    gl_Position = u_matrix * vec4(a_pos, 0, 1) + extrude;
}
