#include "_prelude_fog.fragment.glsl"
#include "_prelude_lighting.glsl"
#include "_prelude_shadow.fragment.glsl"

uniform vec2 u_texsize;
uniform sampler2D u_image;
uniform float u_emissive_strength;

#ifdef RENDER_SHADOWS
uniform vec3 u_ground_shadow_factor;

in highp vec4 v_pos_light_view_0;
in highp vec4 v_pos_light_view_1;
in highp float v_depth;
#endif

in highp vec2 v_pos;
in highp vec2 v_pos_world;

#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp vec4 pattern

void main() {
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize mediump vec4 pattern

    vec2 pattern_tl = pattern.xy;
    vec2 pattern_br = pattern.zw;

    highp vec2 imagecoord = mod(v_pos, 1.0);
    highp vec2 pos = mix(pattern_tl / u_texsize, pattern_br / u_texsize, imagecoord);
    highp vec2 lod_pos = mix(pattern_tl / u_texsize, pattern_br / u_texsize, v_pos);

    // find distance to outline for alpha interpolation

    float dist = length(v_pos_world - gl_FragCoord.xy);
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);

    vec4 out_color = textureLodCustom(u_image, pos, lod_pos);

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

    glFragColor = out_color * (alpha * opacity);

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
