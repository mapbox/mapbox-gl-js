#ifdef GL_ES
precision highp float;
#endif

uniform vec3 u_ground_shadow_factor;

varying vec4 v_pos_light_view_0;
varying vec4 v_pos_light_view_1;
varying float v_depth;

#ifdef FOG
varying float v_fog_opacity;
#endif

void main() {
    float light = shadowed_light_factor(v_pos_light_view_0, v_pos_light_view_1, v_depth);
    vec3 shadow = mix(u_ground_shadow_factor, vec3(1.0), light);

#ifdef FOG
    shadow = mix(shadow, vec3(1.0), v_fog_opacity);
#endif

#ifdef INDICATOR_CUTOUT
    shadow = mix(shadow, vec3(1.0), 1.0 - applyCutout(vec4(1.0)).r);
#endif

    gl_FragColor = vec4(shadow, 1.0);
}
