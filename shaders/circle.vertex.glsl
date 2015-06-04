// set by gl_util
uniform float u_size;

attribute vec2 a_pos;
attribute vec2 a_extrude;

uniform mat4 u_matrix;
uniform mat4 u_exmatrix;

varying vec2 v_extrude;

void main(void) {
    v_extrude = a_extrude;
    vec4 extrude = u_exmatrix * vec4(a_extrude * u_size / 2.0 * sqrt(2.0), 0, 0);
    gl_Position = u_matrix * vec4(a_pos, 0, 1) + extrude;
}
