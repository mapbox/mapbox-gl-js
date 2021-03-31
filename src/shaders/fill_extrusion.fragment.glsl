varying vec4 v_color;

void main() {
    vec4 color = v_color;
    gl_FragColor = color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
