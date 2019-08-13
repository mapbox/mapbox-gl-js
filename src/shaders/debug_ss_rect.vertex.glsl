attribute vec2 a_pos;

uniform vec2 u_offset;
uniform vec2 u_dim;

void main() {
    gl_Position = vec4((a_pos*u_dim)+u_offset, 0, 1);
}
