uniform sampler2D u_texture;
uniform float u_opacity;

in vec2 v_tex_pos;

void main() {
    vec4 color = texture(u_texture, v_tex_pos);
    // a hack to guarantee opacity fade out even with a value close to 1.0
    glFragColor = vec4(floor(255.0 * color * u_opacity) / 255.0);
}
