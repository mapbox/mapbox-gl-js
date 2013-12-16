precision mediump float;

uniform mat4 u_posmatrix;

attribute vec2 a_pos;

varying vec2 v_pos;

void main() {
    v_pos = a_pos;
    gl_Position = u_posmatrix * vec4(a_pos, 0, 1);
}
