uniform vec4 u_color;
uniform float u_opacity;

void main() {
    vec4 out_color = u_color;
    gl_FragColor = out_color * u_opacity;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
