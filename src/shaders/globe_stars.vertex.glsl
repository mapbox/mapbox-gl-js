attribute vec3 a_pos;
attribute vec2 a_merc_pos;
attribute vec2 a_uv;

uniform mat4 u_matrix;
varying float color_variation;

void main() {
    gl_Position = u_matrix * vec4(a_pos, 1.0);
    color_variation = a_uv.x;
}
