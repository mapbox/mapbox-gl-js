precision mediump float;

attribute vec2 a_pos;

uniform float u_pointsize;
uniform mat4 u_posmatrix;

void main() {
    gl_Position = u_posmatrix * vec4(a_pos, step(32767.0, a_pos.x), 1);
    gl_PointSize = u_pointsize;
}
