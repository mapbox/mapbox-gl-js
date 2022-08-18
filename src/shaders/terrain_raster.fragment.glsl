uniform sampler2D u_image0;
varying vec2 v_pos0;

#ifdef FOG
varying float v_fog_opacity;
#endif

#ifdef RENDER_SHADOWS
uniform mat4 u_light_matrix_0;
uniform mat4 u_light_matrix_1;

varying highp vec3 v_shadow_world_pos;
varying float v_depth;
#endif

void main() {
    vec4 color = texture2D(u_image0, v_pos0);

#ifdef RENDER_SHADOWS
    vec4 pos_light_0 = u_light_matrix_0 * vec4(v_shadow_world_pos, 1.0);
    vec4 pos_light_1 = u_light_matrix_1 * vec4(v_shadow_world_pos, 1.0);
    color.xyz = shadowed_color(color.xyz, v_shadow_world_pos, pos_light_0, pos_light_1, v_depth);
#endif

#ifdef FOG
    color = fog_dither(fog_apply_from_vert(color, v_fog_opacity));
#endif
    gl_FragColor = color;
#ifdef TERRAIN_WIREFRAME
    gl_FragColor = vec4(1.0, 0.0, 0.0, 0.8);
#endif
#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
