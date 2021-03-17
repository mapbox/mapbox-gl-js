varying vec4 v_color;

#ifdef FOG
varying float v_depth;
#endif

void main() {
    vec4 color = v_color;
#ifdef FOG
    color.rgb = fog_apply(color.rgb, v_depth);
#endif
    gl_FragColor = color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
