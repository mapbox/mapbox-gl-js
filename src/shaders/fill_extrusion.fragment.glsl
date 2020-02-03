varying vec4 v_color;

void main() {
    // premultiply alpha before rendering
    gl_FragColor = vec4(v_color.rgb * v_color.a, v_color.a);
#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
