precision mediump float;
uniform mat4 u_posmatrix;
uniform float u_brightness_low;
uniform float u_brightness_high;
uniform float u_spin;
attribute vec2 a_pos;
varying vec2 v_pos;

void main(void) {
    gl_Position = u_posmatrix * vec4(a_pos, step(32767.0, a_pos.x), 1);
    v_pos = a_pos / 4096.0;
}
