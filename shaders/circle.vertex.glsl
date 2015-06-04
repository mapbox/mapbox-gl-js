// set by gl_util
uniform mat4 u_matrix;

uniform float u_size;
attribute vec2 a_pos;
attribute vec2 a_extrude;

void main(void) {
    gl_Position = vec4(a_pos + (a_extrude * 10.0), 0, 1);
}
