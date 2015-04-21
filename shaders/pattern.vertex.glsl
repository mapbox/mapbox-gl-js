uniform mat4 u_matrix;
uniform vec2 u_patternscale_a;
uniform vec2 u_patternscale_b;

attribute vec2 a_pos;

varying vec2 v_pos_a;
varying vec2 v_pos_b;

void main() {
    gl_Position = u_matrix * vec4(a_pos, 0, 1);
    v_pos_a = u_patternscale_a * a_pos;
    v_pos_b = u_patternscale_b * a_pos;
}
