#include "_prelude_fog.fragment.glsl"
#include "_prelude_lighting.glsl"

in highp vec2 v_pos;

uniform float u_emissive_strength;

#pragma mapbox: define highp vec4 outline_color
#pragma mapbox: define lowp float opacity

void main() {
    #pragma mapbox: initialize highp vec4 outline_color
    #pragma mapbox: initialize lowp float opacity

    float dist = length(v_pos - gl_FragCoord.xy);
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
    vec4 out_color = outline_color;

#ifdef LIGHTING_3D_MODE
    out_color = apply_lighting_with_emission_ground(out_color, u_emissive_strength);
#endif
#ifdef FOG
    out_color = fog_dither(fog_apply_premultiplied(out_color, v_fog_pos));
#endif

    glFragColor = out_color * (alpha * opacity);

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(1.0);
#endif
    HANDLE_WIREFRAME_DEBUG;
}
