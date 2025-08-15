#include "_prelude_fog.fragment.glsl"
#include "_prelude_lighting.glsl"
#include "_prelude_shadow.fragment.glsl"

uniform highp float u_device_pixel_ratio;
uniform highp float u_width_scale;
uniform highp float u_alpha_discard_threshold;
uniform highp vec2 u_texsize;
uniform highp float u_tile_units_to_pixels;
uniform highp vec2 u_trim_offset;
uniform highp vec2 u_trim_fade_range;
uniform lowp vec4 u_trim_color;

uniform sampler2D u_image;

#ifdef APPLY_LUT_ON_GPU
uniform highp sampler3D u_lutTexture;
#endif

#ifdef LINE_PATTERN_TRANSITION
uniform float u_pattern_transition;
#endif

in vec2 v_normal;
in vec2 v_width2;
in highp float v_linesofar;
in float v_gamma_scale;
in float v_width;
#ifdef RENDER_LINE_TRIM_OFFSET
in highp vec3 v_uv;
#endif
#ifdef ELEVATED_ROADS
in highp float v_road_z_offset;
#endif

#ifdef LINE_JOIN_NONE
in vec2 v_pattern_data; // [pos_in_segment, segment_length];
#endif

#ifdef INDICATOR_CUTOUT
in highp float v_z_offset;
#endif

#ifdef RENDER_SHADOWS
uniform vec3 u_ground_shadow_factor;

in highp vec4 v_pos_light_view_0;
in highp vec4 v_pos_light_view_1;
in highp float v_depth;
#endif

uniform float u_emissive_strength;

#pragma mapbox: define mediump vec4 pattern
#ifdef LINE_PATTERN_TRANSITION
#pragma mapbox: define mediump vec4 pattern_b
#endif
#pragma mapbox: define mediump float pixel_ratio
#pragma mapbox: define mediump float blur
#pragma mapbox: define mediump float opacity

void main() {
    #pragma mapbox: initialize mediump vec4 pattern
    #ifdef LINE_PATTERN_TRANSITION
    #pragma mapbox: initialize mediump vec4 pattern_b
    #endif
    #pragma mapbox: initialize mediump float pixel_ratio
    #pragma mapbox: initialize mediump float blur
    #pragma mapbox: initialize mediump float opacity

    vec2 pattern_tl = pattern.xy;
    vec2 pattern_br = pattern.zw;

    vec2 display_size = (pattern_br - pattern_tl) / pixel_ratio;

    highp float pattern_size = display_size.x / u_tile_units_to_pixels;

    float aspect = display_size.y / v_width;

    // Calculate the distance of the pixel from the line in pixels.
    float dist = length(v_normal) * v_width2.s;

    // Calculate the antialiasing fade factor. This is either when fading in
    // the line in case of an offset line (v_width2.t) or when fading out
    // (v_width2.s)
    float blur2 = (u_width_scale * blur + 1.0 / u_device_pixel_ratio) * v_gamma_scale;
    float alpha = clamp(min(dist - (v_width2.t - blur2), v_width2.s - dist) / blur2, 0.0, 1.0);

    highp float pattern_x = v_linesofar / pattern_size * aspect;
    highp float x = mod(pattern_x, 1.0);

    highp float y = 0.5 * v_normal.y + 0.5;

    vec2 texel_size = 1.0 / u_texsize;

    highp vec2 pos = mix(pattern_tl * texel_size - texel_size, pattern_br * texel_size + texel_size, vec2(x, y));
    highp vec2 lod_pos = mix(pattern_tl * texel_size - texel_size, pattern_br * texel_size + texel_size, vec2(pattern_x, y));
    vec4 color = textureLodCustom(u_image, pos, lod_pos);

#ifdef APPLY_LUT_ON_GPU
    color = applyLUT(u_lutTexture, color);
#endif

#ifdef LINE_PATTERN_TRANSITION
    vec2 pattern_b_tl = pattern_b.xy;
    vec2 pattern_b_br = pattern_b.zw;
    highp vec2 pos_b = mix(pattern_b_tl * texel_size - texel_size, pattern_b_br * texel_size + texel_size, vec2(x, y));
    vec4 color_b = textureLodCustom(u_image, pos_b, lod_pos);
    color = color * (1.0 - u_pattern_transition) + color_b * u_pattern_transition;
#endif

#ifdef RENDER_LINE_TRIM_OFFSET
    highp float trim_start = u_trim_offset[0];
    highp float trim_end = u_trim_offset[1];
    highp float line_progress = v_uv[2];
    // Mark the pixel to be transparent when:
    // 1. trim_offset range is valid
    // 2. line_progress is within trim_offset range

    // Nested conditionals fixes the issue
    // https://github.com/mapbox/mapbox-gl-js/issues/12013
    if (trim_end > trim_start) {
        highp float start_transition = max(0.0, min(1.0, (line_progress - trim_start) / max(u_trim_fade_range[0], 1.0e-9)));
        highp float end_transition = max(0.0, min(1.0, (trim_end - line_progress) / max(u_trim_fade_range[1], 1.0e-9)));
        highp float transition_factor = min(start_transition, end_transition);
        color = mix(color, color.a * u_trim_color, transition_factor);
    }
#endif

#ifdef LINE_JOIN_NONE
    // v_pattern_data = { x = pos_in_segment, y = segment_length }
    // v_linesofar and v_pattern_data.x is offset in vertex shader based on segment overlap (v_pattern_data.x can be
    // negative). v_pattern_data.y is not modified because we can't access overlap info for other end of the segment.
    // All units are tile units.
    // Distance from segment start point to start of first pattern instance
    highp float pattern_len = pattern_size / aspect;
    highp float segment_phase = pattern_len - mod(v_linesofar - v_pattern_data.x + pattern_len, pattern_len);
    // Step is used to check if we can fit an extra pattern cycle when considering the segment overlap at the corner
    highp float visible_start = segment_phase - step(pattern_len * 0.5, segment_phase) * pattern_len;
    highp float visible_end = floor((v_pattern_data.y - segment_phase) / pattern_len) * pattern_len + segment_phase;
    visible_end += step(pattern_len * 0.5, v_pattern_data.y - visible_end) * pattern_len;

    if (v_pattern_data.x < visible_start || v_pattern_data.x >= visible_end) {
        color = vec4(0.0);
    }
#endif

#ifdef LIGHTING_3D_MODE
    color = apply_lighting_with_emission_ground(color, u_emissive_strength);
#ifdef RENDER_SHADOWS
    float light = shadowed_light_factor(v_pos_light_view_0, v_pos_light_view_1, v_depth);
#ifdef ELEVATED_ROADS
    color.rgb *= mix(v_road_z_offset != 0.0 ? u_ground_shadow_factor : vec3(1.0), vec3(1.0), light);
#else
    color.rgb *= mix(u_ground_shadow_factor, vec3(1.0), light);
#endif // ELEVATED_ROADS
#endif // RENDER_SHADOWS
#endif
#ifdef FOG
    color = fog_dither(fog_apply_premultiplied(color, v_fog_pos));
#endif

    color *= (alpha * opacity);

    if (u_alpha_discard_threshold != 0.0) {
        if (color.a < u_alpha_discard_threshold) {
            discard;
        }
    }
#ifdef INDICATOR_CUTOUT
    color = applyCutout(color, v_z_offset);
#endif

    glFragColor = color;

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
