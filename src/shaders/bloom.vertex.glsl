attribute vec2 a_pos_2f;

void main() {
    gl_Position = vec4(a_pos_2f, 0, 1);
}
