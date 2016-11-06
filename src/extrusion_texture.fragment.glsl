uniform sampler2D u_texture;
uniform float u_opacity;

varying vec2 v_pos;

void main() {
    gl_FragColor = texture2D(u_texture, v_pos) * u_opacity;
}
