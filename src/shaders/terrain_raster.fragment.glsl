uniform sampler2D u_image0;
varying vec2 v_pos0;

#ifdef FOG
varying float v_fog_opacity;
#ifdef FOG_HAZE
varying vec3 v_haze_color;
#endif
#endif

void main() {
    vec4 color = texture2D(u_image0, v_pos0);
#ifdef FOG
#ifdef FOG_HAZE
    color.rgb = fog_dither(fog_apply_from_vert(color.rgb, v_fog_opacity, v_haze_color));
#else
    vec3 unused;
    color.rgb = fog_dither(fog_apply_from_vert(color.rgb, v_fog_opacity, unused));
#endif
#endif
    gl_FragColor = color;
#ifdef TERRAIN_WIREFRAME
    gl_FragColor = vec4(1.0, 0.0, 0.0, 0.8);
#endif
#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
