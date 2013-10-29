// these are the shaders for rendering filled areas

precision mediump float;

attribute vec2 a_pos;

uniform mat4 u_posmatrix;

void main() {
    gl_Position = u_posmatrix * vec4(floor(a_pos / 2.0), 0, 1);
    gl_PointSize = 2.0;
}
