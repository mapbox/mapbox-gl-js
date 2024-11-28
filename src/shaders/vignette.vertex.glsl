in vec2 a_pos_2f;

out vec2 st;

void main() {
    st = a_pos_2f;

    gl_Position = vec4(a_pos_2f, 0, 1);
}
