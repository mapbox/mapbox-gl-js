#ifdef GL_ES
precision highp float;
#endif

varying vec4 v_pos_light_view_0;
varying vec4 v_pos_light_view_1;
varying float v_depth;

#ifdef FOG
varying float v_fog_opacity;
#endif

void main() {
    vec3 shadow = shadowed_color(vec3(1.0), v_pos_light_view_0, v_pos_light_view_1, v_depth);
#ifdef FOG
    shadow = mix(shadow, vec3(1.0), v_fog_opacity);
#endif
    gl_FragColor = vec4(shadow, 1.0);
}
