uniform sampler2D u_texture;

varying vec2 v_tex;
varying float v_alpha;

void main() {
    gl_FragColor = texture2D(u_texture, v_tex) * v_alpha;
}
