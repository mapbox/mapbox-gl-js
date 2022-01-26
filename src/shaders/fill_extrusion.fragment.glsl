varying vec4 v_color;
varying float v_gradient;

void main() {
    vec4 color = vec4(v_color.xyz * pow(v_gradient, 10.0), v_color.a);
#ifdef FOG
    color = fog_dither(fog_apply_premultiplied(color, v_fog_pos));
#endif
    gl_FragColor = color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
