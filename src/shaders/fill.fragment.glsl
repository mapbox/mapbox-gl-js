#pragma mapbox: define highp vec4 color
#pragma mapbox: define lowp float opacity

#ifdef FOG
varying float v_depth;
#endif

void main() {
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize lowp float opacity

    vec4 out_color = color * opacity;

#ifdef FOG
    out_color.rgb = fog_apply(out_color.rgb, v_depth);
#endif

    gl_FragColor = out_color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
