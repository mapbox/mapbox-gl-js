precision mediump float;

uniform mat4 u_posmatrix;
uniform vec2 u_tl_parent;
uniform float u_scale_parent;

attribute vec2 a_pos;

varying vec2 v_pos0;
varying vec2 v_pos1;

void main(void) {
    gl_Position = u_posmatrix * vec4(a_pos, 0, 1);
    v_pos0 = a_pos / 4096.0;
    v_pos1 = (v_pos0 * u_scale_parent) + u_tl_parent;
}
