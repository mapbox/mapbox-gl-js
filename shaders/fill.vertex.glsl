uniform mat4 u_matrix;

attribute vec2 a_pos;
attribute vec4 a_color;
attribute float a_opacity;

varying vec4 v_color;

void main() {
    gl_Position = u_matrix * vec4(a_pos, 0, 1);
    v_color = a_color / 255.0 * a_opacity / 255.0;
}
