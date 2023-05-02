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
    vec4 image_color = texture2D(u_image0, v_pos0);
    vec4 color;

#ifdef LIGHTING_3D_MODE
    const vec3 normal = vec3(0.0, 0.0, 1.0);

    float lighting_factor;
#ifdef RENDER_SHADOWS
    lighting_factor = shadowed_light_factor_normal(normal, v_pos_light_view_0, v_pos_light_view_1, v_depth);
#else // RENDER_SHADOWS
    lighting_factor = calculate_NdotL(normal);
#endif // !RENDER_SHADOWS

    color = apply_lighting(image_color, normal, lighting_factor);

#ifdef LIGHTING_3D_ALPHA_EMISSIVENESS
    color.rgb = mix(color.rgb, image_color.rgb, image_color.a);
    color.a = 1.0;
#endif // LIGHTING_3D_ALPHA_EMISSIVENESS

#else // LIGHTING_3D_MODE
    color = image_color;
#endif // !LIGHTING_3D_MODE

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
