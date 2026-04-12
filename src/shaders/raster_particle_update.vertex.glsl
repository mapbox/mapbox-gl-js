in ivec2 a_pos;

out vec2 v_tex_coord;

void main() {
    v_tex_coord = 0.5 * vec2(a_pos + ivec2(1));
    gl_Position = vec4(a_pos, 0.0, 1.0);
}
