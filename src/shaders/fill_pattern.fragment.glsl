#include "_prelude_fog.fragment.glsl"
#include "_prelude_lighting.glsl"
#include "_prelude_shadow.fragment.glsl"

uniform vec2 u_texsize;

uniform sampler2D u_image;

#ifdef FILL_PATTERN_TRANSITION
uniform float u_pattern_transition;
#endif

in highp vec2 v_pos;

uniform float u_emissive_strength;

#ifdef RENDER_SHADOWS
uniform vec3 u_ground_shadow_factor;

in highp vec4 v_pos_light_view_0;
in highp vec4 v_pos_light_view_1;
in highp float v_depth;
#endif

#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp vec4 pattern
#ifdef FILL_PATTERN_TRANSITION
#pragma mapbox: define mediump vec4 pattern_b
#endif

void main() {
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize mediump vec4 pattern
    #ifdef FILL_PATTERN_TRANSITION
    #pragma mapbox: initialize mediump vec4 pattern_b
    #endif

    vec2 pattern_tl = pattern.xy;
    vec2 pattern_br = pattern.zw;

    highp vec2 imagecoord = mod(v_pos, 1.0);
    highp vec2 pos = mix(pattern_tl / u_texsize, pattern_br / u_texsize, imagecoord);
    highp vec2 lod_pos = mix(pattern_tl / u_texsize, pattern_br / u_texsize, v_pos);
    vec4 out_color = textureLodCustom(u_image, pos, lod_pos);

#ifdef FILL_PATTERN_TRANSITION
    vec2 pattern_b_tl = pattern_b.xy;
    vec2 pattern_b_br = pattern_b.zw;
    highp vec2 pos_b = mix(pattern_b_tl / u_texsize, pattern_b_br / u_texsize, imagecoord);
    vec4 color_b = textureLodCustom(u_image, pos_b, lod_pos);
    out_color = out_color * (1.0 - u_pattern_transition) + color_b * u_pattern_transition;
#endif

#ifdef LIGHTING_3D_MODE
    out_color = apply_lighting_with_emission_ground(out_color, u_emissive_strength);
#ifdef RENDER_SHADOWS
    float light = shadowed_light_factor(v_pos_light_view_0, v_pos_light_view_1, v_depth);
    out_color.rgb *= mix(u_ground_shadow_factor, vec3(1.0), light);
#endif // RENDER_SHADOWS
#endif // LIGHTING_3D_MODE

#ifdef FOG
    out_color = fog_dither(fog_apply_premultiplied(out_color, v_fog_pos));
#endif

    glFragColor = out_color * opacity;

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
