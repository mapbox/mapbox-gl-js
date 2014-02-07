precision mediump float;

uniform mat4 u_posmatrix;
uniform float u_size;

attribute vec2 a_pos;

void main(void) {
    gl_Position = u_posmatrix * vec4(floor(a_pos / 2.0), 0, 1);
    gl_PointSize = u_size;
}
