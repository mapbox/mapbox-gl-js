precision mediump float;

attribute vec2 a_pos;

uniform mat4 u_posmatrix;
uniform float u_pointsize;
uniform float u_scale;

void main() {
    gl_Position = u_posmatrix * vec4(floor(a_pos / u_scale), 0, 1);
    gl_PointSize = u_pointsize;
}
