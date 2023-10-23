#include "_prelude_fog.fragment.glsl"
#include "_prelude_lighting.glsl"

uniform vec2 u_texsize;
uniform sampler2D u_image;
uniform float u_emissive_strength;

varying vec2 v_pos;
varying vec2 v_pos_world;

#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp vec4 pattern

void main() {
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize mediump vec4 pattern

    vec2 pattern_tl = pattern.xy;
    vec2 pattern_br = pattern.zw;

    vec2 imagecoord = mod(v_pos, 1.0);
    vec2 pos = mix(pattern_tl / u_texsize, pattern_br / u_texsize, imagecoord);

    // find distance to outline for alpha interpolation

    float dist = length(v_pos_world - gl_FragCoord.xy);
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);

    vec4 out_color = texture2D(u_image, pos);

#ifdef LIGHTING_3D_MODE
    out_color = apply_lighting_with_emission_ground(out_color, u_emissive_strength);
#endif
#ifdef FOG
    out_color = fog_dither(fog_apply_premultiplied(out_color, v_fog_pos));
#endif

    gl_FragColor = out_color * (alpha * opacity);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
