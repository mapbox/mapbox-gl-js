varying vec4 v_color;

#ifdef FAUX_AO
varying vec3 v_ao;
#endif

void main() {
    vec4 color = v_color;
#ifdef FAUX_AO
    float y_shade = v_ao.y;
    float shade = 0.96 * (y_shade + (1.0 - y_shade) * (1.0 - pow(1.0 - min(v_ao.z * 0.02, 1.0), 15.0))) + 0.04 * min(v_ao.z * 0.002, 1.0);
    // concave angle
    float concave = v_ao.x * v_ao.x;
    float x_shade = mix(0.92, 0.98, min(v_ao.z * 0.01, 1.0)) - mix(0.08, 0.0, min(v_ao.z / 3.0, 1.0));
    shade *= mix(1.0, x_shade * x_shade, concave);
    color.rgb = color.rgb * shade;
#endif
#ifdef FOG
    color = fog_dither(fog_apply_premultiplied(color, v_fog_pos));
#endif
    gl_FragColor = color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
