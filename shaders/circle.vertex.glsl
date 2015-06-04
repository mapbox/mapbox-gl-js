// set by gl_util
uniform mat4 u_matrix;
uniform mat4 u_exmatrix;

uniform float u_size;

attribute vec2 a_pos;
attribute vec2 a_extrude;

void main(void) {
    // vec4 extrude = u_exmatrix * vec4(a_extrude / 64.0, 0, 0);
    gl_Position = vec4(a_pos, 0, 1);
}
