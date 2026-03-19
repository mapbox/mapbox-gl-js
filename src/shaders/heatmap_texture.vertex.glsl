in ivec2 a_pos;
out vec2 v_pos;

void main() {
    gl_Position = vec4(a_pos, 0, 1);

    v_pos = vec2(a_pos) * 0.5 + 0.5;
}
