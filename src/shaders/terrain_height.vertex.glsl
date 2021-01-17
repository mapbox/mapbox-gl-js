attribute vec2 a_pos;
varying vec2 v_pos;

uniform mat4 u_matrix;

void main() {
    // This vertex shader expects a EXTENT x EXTENT quad
    v_pos = a_pos;
    gl_Position = u_matrix * vec4(a_pos , 0, 1);
}