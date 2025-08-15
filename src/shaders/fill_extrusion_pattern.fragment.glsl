#include "_prelude_fog.fragment.glsl"
#include "_prelude_lighting.glsl"

uniform vec2 u_texsize;

uniform sampler2D u_image;

#ifdef FILL_EXTRUSION_PATTERN_TRANSITION
uniform float u_pattern_transition;
#endif

#ifdef FAUX_AO
uniform lowp vec2 u_ao;
in vec3 v_ao;
#endif

#ifdef LIGHTING_3D_MODE
in vec3 v_normal;
#endif

#ifdef APPLY_LUT_ON_GPU
uniform highp sampler3D u_lutTexture;
#endif

in highp vec2 v_pos;
in vec4 v_lighting;

uniform lowp float u_opacity;

#pragma mapbox: define highp float base
#pragma mapbox: define highp float height
#pragma mapbox: define mediump vec4 pattern
#ifdef FILL_EXTRUSION_PATTERN_TRANSITION
#pragma mapbox: define mediump vec4 pattern_b
#endif
#pragma mapbox: define highp float pixel_ratio

void main() {
    #pragma mapbox: initialize highp float base
    #pragma mapbox: initialize highp float height
    #pragma mapbox: initialize mediump vec4 pattern
    #ifdef FILL_EXTRUSION_PATTERN_TRANSITION
    #pragma mapbox: initialize mediump vec4 pattern_b
    #endif
    #pragma mapbox: initialize highp float pixel_ratio

    vec2 pattern_tl = pattern.xy;
    vec2 pattern_br = pattern.zw;

    highp vec2 imagecoord = mod(v_pos, 1.0);
    highp vec2 pos = mix(pattern_tl / u_texsize, pattern_br / u_texsize, imagecoord);
    highp vec2 lod_pos = mix(pattern_tl / u_texsize, pattern_br / u_texsize, v_pos);
    vec4 out_color = textureLodCustom(u_image, pos, lod_pos);

#ifdef APPLY_LUT_ON_GPU
    out_color = applyLUT(u_lutTexture, out_color);
#endif

#ifdef FILL_EXTRUSION_PATTERN_TRANSITION
    vec2 pattern_b_tl = pattern_b.xy;
    vec2 pattern_b_br = pattern_b.zw;
    highp vec2 pos_b = mix(pattern_b_tl / u_texsize, pattern_b_br / u_texsize, imagecoord);
    vec4 color_b = textureLodCustom(u_image, pos_b, lod_pos);
    out_color = out_color * (1.0 - u_pattern_transition) + color_b * u_pattern_transition;
#endif

#ifdef LIGHTING_3D_MODE
    out_color = apply_lighting(out_color, normalize(v_normal)) * u_opacity;
#else
    out_color = out_color * v_lighting;
#endif

#ifdef FAUX_AO
    float intensity = u_ao[0];
    float h = max(0.0, v_ao.z);
    float h_floors = h / u_ao[1];
    float y_shade = 1.0 - 0.9 * intensity * min(v_ao.y, 1.0);
    float shade = (1.0 - 0.08 * intensity) * (y_shade + (1.0 - y_shade) * (1.0 - pow(1.0 - min(h_floors / 16.0, 1.0), 16.0))) + 0.08 * intensity * min(h_floors / 160.0, 1.0);
    // concave angle
    float concave = v_ao.x * v_ao.x;
    float x_shade = mix(1.0, mix(0.6, 0.75, min(h_floors / 30.0, 1.0)), intensity) + 0.1 * intensity * min(h, 1.0);
    shade *= mix(1.0, x_shade * x_shade * x_shade, concave);
    out_color.rgb = out_color.rgb * shade;
#endif
#ifdef FOG
    out_color = fog_dither(fog_apply_premultiplied(out_color, v_fog_pos));
#endif

#ifdef INDICATOR_CUTOUT
    // TODO: maybe use height from vertex shader?
    out_color = applyCutout(out_color, height);
#endif

    glFragColor = out_color;

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
