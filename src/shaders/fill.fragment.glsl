#pragma mapbox: define highp vec4 color
#pragma mapbox: define lowp float opacity

#ifdef FOG
varying vec3 v_fog_pos;
#endif

void main() {
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize lowp float opacity

    vec4 out_color = color;

#ifdef FOG
    out_color = fog_apply_premultiplied(out_color, v_fog_pos);
#endif

    gl_FragColor = out_color * opacity;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
