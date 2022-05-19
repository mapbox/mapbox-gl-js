varying vec4 v_color;

#ifdef FAUX_AO
uniform lowp vec2 u_ao;
varying vec3 v_ao;
#endif

void main() {
    vec4 color = v_color;
#ifdef FAUX_AO
    float intensity = 1.0 - sqrt(1.0 - u_ao[0]);
    float h = max(0.0, v_ao.z);
    float h_floors = h / u_ao[1];
    float y_shade = mix(1.0, 0.1, intensity * min(v_ao.y, 1.0));
    float shade = mix(1.0, 0.92, intensity) * (y_shade + (1.0 - y_shade) * (1.0 - pow(1.0 - min(h_floors / 16.0, 1.0), 16.0))) + 0.08 * intensity * min(h_floors / 160.0, 1.0);
    // concave angle
    float concave = v_ao.x * v_ao.x;
    float x_shade = mix(1.0, mix(0.6, 0.75, min(h_floors / 30.0, 1.0)), intensity) + intensity * mix(0.0, 0.1, min(h, 1.0));
    shade *= mix(1.0, x_shade * x_shade * x_shade, concave);
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
