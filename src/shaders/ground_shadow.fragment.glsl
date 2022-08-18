#ifdef GL_ES
precision highp float;
#endif

uniform mat4 u_light_matrix_0;
uniform mat4 u_light_matrix_1;
varying vec2 v_shadow_world_pos;
varying float v_depth;

#ifdef FOG
varying float v_fog_opacity;
#endif

void main() {
    vec4 pos_light_0 = u_light_matrix_0 * vec4(v_shadow_world_pos, 0.0, 1.0);
    vec4 pos_light_1 = u_light_matrix_1 * vec4(v_shadow_world_pos, 0.0, 1.0);
    vec3 shadow = shadowed_color(vec3(1.0), vec3(v_shadow_world_pos, 0.0), pos_light_0, pos_light_1, v_depth);
#ifdef FOG
    shadow = mix(shadow, vec3(1.0), v_fog_opacity);
#endif
    gl_FragColor = vec4(shadow, 1.0);
}
