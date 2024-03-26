in vec2 a_pos;

out vec2 v_tex_pos;

void main() {
    v_tex_pos = 0.5 * a_pos + vec2(0.5);
    gl_Position = vec4(a_pos, 0.0, 1.0);
}
