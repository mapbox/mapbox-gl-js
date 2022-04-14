uniform sampler2D u_image0;
varying vec2 v_pos0;

uniform lowp vec3 u_lightpos;

#ifdef FOG
varying float v_fog_opacity;
#endif


varying vec4 v_pos_light_view_0;
varying vec4 v_pos_light_view_1;
varying float v_depth;


void main() {
    vec4 color = texture2D(u_image0, v_pos0);

#ifdef RENDER_SHADOWS
    float biasL0 = 0.002;
    float biasL1 = 0.002;
    float occlusionL0 = shadowOcclusionL0(v_pos_light_view_0, biasL0);
    float occlusionL1 = shadowOcclusionL1(v_pos_light_view_1, biasL1);

    float occlusion = 0.0; 
    if (v_depth < u_cascade_distances.x)
        occlusion = occlusionL0;
    else if (v_depth < u_cascade_distances.y)
        occlusion = occlusionL1;

    color.xyz = color.xyz * mix(1.0, 1.0 - u_shadow_intensity, occlusion);
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
