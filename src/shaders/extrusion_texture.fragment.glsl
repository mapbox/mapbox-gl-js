uniform sampler2D u_texture;
uniform float u_opacity;

varying vec2 v_pos;

void main() {
    gl_FragColor = texture2D(u_texture, v_pos) * u_opacity;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(0.0);
#endif
}
