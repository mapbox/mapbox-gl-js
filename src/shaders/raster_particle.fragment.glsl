#include "_prelude_fog.fragment.glsl"
#include "_prelude_lighting.glsl"

uniform float u_fade_t;
uniform float u_opacity;
uniform highp float u_raster_elevation;

in vec2 v_pos0;
in vec2 v_pos1;

uniform sampler2D u_image0;
uniform sampler2D u_image1;

void main() {
    vec4 color0, color1, color;

    // read and cross-fade colors from the main and parent tiles
    color0 = texture(u_image0, v_pos0);
    color1 = texture(u_image1, v_pos1);

    if (color0.a > 0.0) color0.rgb /= color0.a;
    if (color1.a > 0.0) color1.rgb /= color1.a;
    color = mix(color0, color1, u_fade_t);
    color.a *= u_opacity;

    vec3 out_color = color.rgb;

#ifdef LIGHTING_3D_MODE
    out_color = apply_lighting_with_emission_ground(vec4(out_color, 1.0), 0.0).rgb;
#endif
#ifdef FOG
    highp float fog_limit_high_meters = 1000000.0;
    highp float fog_limit_low_meters = 600000.0;
    float fog_limit = 1.0 - smoothstep(fog_limit_low_meters, fog_limit_high_meters, u_raster_elevation);
    out_color = fog_dither(fog_apply(out_color, v_fog_pos, fog_limit));
#endif

    glFragColor = vec4(out_color * color.a, color.a);

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
