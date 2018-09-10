uniform mat4 u_matrix;
uniform vec2 u_world;
attribute vec2 a_pos;

varying vec2 v_pos;

void main() {
    gl_Position = u_matrix * vec4(a_pos * u_world, 0, 1);
    v_pos = a_pos;
}
