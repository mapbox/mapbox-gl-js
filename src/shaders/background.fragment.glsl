uniform vec4 u_color;
uniform float u_opacity;

#ifdef FOG_OR_HAZE
varying vec3 v_fog_pos;
#endif

void main() {
    vec4 out_color = u_color;

#ifdef FOG_OR_HAZE
    out_color = fog_dither(fog_haze_apply_premultiplied(out_color, v_fog_pos));
#endif

    gl_FragColor = out_color * u_opacity;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
