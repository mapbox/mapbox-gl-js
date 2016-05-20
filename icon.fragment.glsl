uniform sampler2D u_texture;
uniform sampler2D u_fadetexture;
uniform float u_opacity;

varying vec2 v_tex;
varying vec2 v_fade_tex;

void main() {
    float alpha = texture2D(u_fadetexture, v_fade_tex).a * u_opacity;
    gl_FragColor = texture2D(u_texture, v_tex) * alpha;
}
