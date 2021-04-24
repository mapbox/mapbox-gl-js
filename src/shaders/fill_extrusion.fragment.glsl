varying vec4 v_color;

#ifdef FOG_OR_HAZE
varying vec3 v_fog_pos;
#endif

void main() {
    vec4 color = v_color;
#ifdef FOG_OR_HAZE
    color = fog_dither(fog_haze_apply_premultiplied(color, v_fog_pos));
#endif
    gl_FragColor = color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
