#include "_prelude_fog.fragment.glsl"
#include "_prelude_lighting.glsl"

uniform vec2 u_pattern_tl;
uniform vec2 u_pattern_br;
uniform vec2 u_texsize;
uniform float u_opacity;
uniform float u_emissive_strength;

uniform sampler2D u_image;

in highp vec2 v_pos;

void main() {
    highp vec2 imagecoord = mod(v_pos, 1.0);
    highp vec2 pos = mix(u_pattern_tl / u_texsize, u_pattern_br / u_texsize, imagecoord);
    vec4 out_color = textureLodCustom(u_image, pos, v_pos);

#ifdef LIGHTING_3D_MODE
    out_color = apply_lighting_with_emission_ground(out_color, u_emissive_strength);
#endif
#ifdef FOG
    out_color = fog_dither(fog_apply_premultiplied(out_color, v_fog_pos));
#endif

    glFragColor = out_color * u_opacity;

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
