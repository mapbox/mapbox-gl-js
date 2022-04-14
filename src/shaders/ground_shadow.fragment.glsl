#ifdef GL_ES
precision highp float;
#endif

varying vec2 v_uv;
varying vec4 v_pos_light_view_0;
varying vec4 v_pos_light_view_1;
varying float v_depth;

void main() {
    float occlusionL0 = shadowOcclusionL0(v_pos_light_view_0, 0.001);
    float occlusionL1 = shadowOcclusionL1(v_pos_light_view_1, 0.001);
    float occlusion = 0.0; 

    if (v_depth < u_cascade_distances.x)
        occlusion = occlusionL0;
    else if (v_depth < u_cascade_distances.y)
        occlusion = occlusionL1;

    float shadow = mix(1.0, 1.0 - u_shadow_intensity, occlusion);

    gl_FragColor = vec4(shadow, shadow, shadow, 1.0);
}
