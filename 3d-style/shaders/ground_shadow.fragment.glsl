#include "_prelude_shadow.fragment.glsl"

precision highp float;

uniform vec3 u_ground_shadow_factor;

in vec4 v_pos_light_view_0;
in vec4 v_pos_light_view_1;

#ifdef FOG
in float v_fog_opacity;
#endif

void main() {
    float light = shadowed_light_factor(v_pos_light_view_0, v_pos_light_view_1, 1.0 / gl_FragCoord.w);
    vec3 shadow = mix(u_ground_shadow_factor, vec3(1.0), light);

#ifdef RENDER_CUTOFF
    shadow = mix(vec3(1.0), shadow, cutoff_opacity(u_cutoff_params, 1.0 / gl_FragCoord.w));
#endif
#ifdef FOG
    shadow = mix(shadow, vec3(1.0), v_fog_opacity);
#endif

#ifdef INDICATOR_CUTOUT
    shadow = mix(shadow, vec3(1.0), 1.0 - applyCutout(vec4(1.0)).r);
#endif

    glFragColor = vec4(shadow, 1.0);
}
