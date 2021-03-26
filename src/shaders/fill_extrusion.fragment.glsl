varying vec4 v_color;

#ifdef FOG
varying vec3 v_fog_pos;
#endif

void main() {
    vec4 color = v_color;
#ifdef FOG
    color = fog_dither(fog_apply_premultiplied(color, v_fog_pos));
#endif
    gl_FragColor = color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
