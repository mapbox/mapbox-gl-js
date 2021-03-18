varying vec2 v_pos;

#pragma mapbox: define highp vec4 outline_color
#pragma mapbox: define lowp float opacity

#ifdef FOG
varying float v_depth;
#endif

void main() {
    #pragma mapbox: initialize highp vec4 outline_color
    #pragma mapbox: initialize lowp float opacity

    float dist = length(v_pos * gl_FragCoord.w - gl_FragCoord.xy);
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
    vec4 out_color = outline_color * (alpha * opacity);

#ifdef FOG
    out_color.rgb = fog_apply(out_color.rgb, v_depth);
#endif

    gl_FragColor = out_color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
