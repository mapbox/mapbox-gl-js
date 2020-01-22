varying vec4 v_color;

void main() {
    gl_FragColor = vec4(v_color.a, 1.0, 1.0, 1.0);
#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
