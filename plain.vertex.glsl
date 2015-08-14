attribute vec2 a_pos;

uniform mat4 u_matrix;

void main() {
    gl_Position = u_matrix * vec4(a_pos, 0, 1);
    gl_Position.z = 1.0;
}
