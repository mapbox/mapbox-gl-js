uniform sampler2D u_image0;
varying vec2 v_pos0;

#ifdef FOG
varying float v_fog_opacity;
#endif

#ifdef RENDER_SHADOWS
varying vec4 v_pos_light_view_0;
varying vec4 v_pos_light_view_1;
varying float v_depth;
#endif

void main() {
    vec4 color = texture2D(u_image0, v_pos0);

#ifdef RENDER_SHADOWS
    color.xyz = shadowed_color(color.xyz, v_pos_light_view_0, v_pos_light_view_1, v_depth);
#endif

#ifdef FOG
#ifdef ZERO_EXAGGERATION
    color = fog_dither(fog_apply_premultiplied(color, v_fog_pos));
#else
    color = fog_dither(fog_apply_from_vert(color, v_fog_opacity));
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
