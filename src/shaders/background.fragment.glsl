uniform vec4 u_color;
uniform float u_opacity;

#ifdef FOG
varying float v_depth;
#endif

void main() {
    vec4 out_color = u_color * u_opacity;

#ifdef FOG
    out_color.rgb = fog_apply(out_color.rgb, v_depth);
#endif

    gl_FragColor = out_color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
