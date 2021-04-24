uniform sampler2D u_image0;
varying vec2 v_pos0;

#ifdef FOG
varying float v_fog_opacity;
#endif

#ifdef HAZE
varying float v_haze_opacity;
#endif

void main() {
    vec4 color = texture2D(u_image0, v_pos0);
#ifdef FOG
    color.rgb = fog_dither(fog_apply_from_vert(color.rgb, v_fog_opacity));
#endif
#ifdef HAZE
    color.rgb = haze_apply_from_vert(color.rgb, v_haze_opacity);
#endif
#ifdef FOG_OR_HAZE
    color.rgb = fog_dither(color.rgb);
#endif
    gl_FragColor = color;
#ifdef TERRAIN_WIREFRAME
    gl_FragColor = vec4(1.0, 0.0, 0.0, 0.8);
#endif
#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
