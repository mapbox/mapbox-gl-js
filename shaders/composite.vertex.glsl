attribute vec2 a_pos;

uniform mat4 u_posmatrix;
varying vec2 v_pos;

void main() {
    gl_Position = u_posmatrix * vec4(a_pos, 0, 1);
    v_pos = gl_Position.xy;
}
