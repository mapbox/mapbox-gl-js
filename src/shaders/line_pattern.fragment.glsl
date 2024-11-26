#include "_prelude_fog.fragment.glsl"
#include "_prelude_lighting.glsl"
#include "_prelude_shadow.fragment.glsl"

uniform highp float u_device_pixel_ratio;
uniform highp float u_alpha_discard_threshold;
uniform highp vec2 u_texsize;
uniform highp float u_tile_units_to_pixels;
uniform highp vec2 u_trim_offset;

uniform sampler2D u_image;

in vec2 v_normal;
in vec2 v_width2;
in highp float v_linesofar;
in float v_gamma_scale;
in float v_width;
#ifdef RENDER_LINE_TRIM_OFFSET
in highp vec4 v_uv;
#endif

#ifdef LINE_JOIN_NONE
in vec2 v_pattern_data; // [pos_in_segment, segment_length];
#endif

#ifdef RENDER_SHADOWS
uniform vec3 u_ground_shadow_factor;

in highp vec4 v_pos_light_view_0;
in highp vec4 v_pos_light_view_1;
in highp float v_depth;
#endif

uniform float u_emissive_strength;

#pragma mapbox: define mediump vec4 pattern
#pragma mapbox: define mediump float pixel_ratio
#pragma mapbox: define mediump float blur
#pragma mapbox: define mediump float opacity

void main() {
    #pragma mapbox: initialize mediump vec4 pattern
    #pragma mapbox: initialize mediump float pixel_ratio
    #pragma mapbox: initialize mediump float blur
    #pragma mapbox: initialize mediump float opacity

    vec2 pattern_tl = pattern.xy;
    vec2 pattern_br = pattern.zw;

    vec2 display_size = (pattern_br - pattern_tl) / pixel_ratio;

    float pattern_size = display_size.x / u_tile_units_to_pixels;

    float aspect = display_size.y / v_width;

    // Calculate the distance of the pixel from the line in pixels.
    float dist = length(v_normal) * v_width2.s;

    // Calculate the antialiasing fade factor. This is either when fading in
    // the line in case of an offset line (v_width2.t) or when fading out
    // (v_width2.s)
    float blur2 = (blur + 1.0 / u_device_pixel_ratio) * v_gamma_scale;
    float alpha = clamp(min(dist - (v_width2.t - blur2), v_width2.s - dist) / blur2, 0.0, 1.0);

    highp float pattern_x = v_linesofar / pattern_size * aspect;
    highp float x = mod(pattern_x, 1.0);

    highp float y = 0.5 * v_normal.y + 0.5;

    vec2 texel_size = 1.0 / u_texsize;

    highp vec2 pos = mix(pattern_tl * texel_size - texel_size, pattern_br * texel_size + texel_size, vec2(x, y));
    highp vec2 lod_pos = mix(pattern_tl * texel_size - texel_size, pattern_br * texel_size + texel_size, vec2(pattern_x, y));
    vec4 color = textureLodCustom(u_image, pos, lod_pos);

#ifdef RENDER_LINE_TRIM_OFFSET
    // v_uv[2] and v_uv[3] are specifying the original clip range that the vertex is located in.
    highp float start = v_uv[2];
    highp float end = v_uv[3];
    highp float trim_start = u_trim_offset[0];
    highp float trim_end = u_trim_offset[1];
    // v_uv.x is the relative prorgress based on each clip. Calculate the absolute progress based on
    // the whole line by combining the clip start and end value.
    highp float line_progress = (start + (v_uv.x) * (end - start));
    // Mark the pixel to be transparent when:
    // 1. trim_offset range is valid
    // 2. line_progress is within trim_offset range

    // Nested conditionals fixes the issue
    // https://github.com/mapbox/mapbox-gl-js/issues/12013
    if (trim_end > trim_start) {
        if (line_progress <= trim_end && line_progress >= trim_start) {
            color = vec4(0, 0, 0, 0);
        }
    }
#endif

#ifdef LINE_JOIN_NONE
    // v_pattern_data = { x = pos_in_segment, y = segment_length }
    // v_linesofar and v_pattern_data.x is offset in vertex shader based on segment overlap (v_pattern_data.x can be
    // negative). v_pattern_data.y is not modified because we can't access overlap info for other end of the segment.
    // All units are tile units.
    // Distance from segment start point to start of first pattern instance
    float pattern_len = pattern_size / aspect;
    float segment_phase = pattern_len - mod(v_linesofar - v_pattern_data.x + pattern_len, pattern_len);
    // Step is used to check if we can fit an extra pattern cycle when considering the segment overlap at the corner
    float visible_start = segment_phase - step(pattern_len * 0.5, segment_phase) * pattern_len;
    float visible_end = floor((v_pattern_data.y - segment_phase) / pattern_len) * pattern_len + segment_phase;
    visible_end += step(pattern_len * 0.5, v_pattern_data.y - visible_end) * pattern_len;

    if (v_pattern_data.x < visible_start || v_pattern_data.x >= visible_end) {
        color = vec4(0.0);
    }
#endif

#ifdef LIGHTING_3D_MODE
    color = apply_lighting_with_emission_ground(color, u_emissive_strength);
#ifdef RENDER_SHADOWS
    float light = shadowed_light_factor(v_pos_light_view_0, v_pos_light_view_1, v_depth);
    color.rgb *= mix(u_ground_shadow_factor, vec3(1.0), light);
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
    color = applyCutout(color);
#endif

    glFragColor = color;

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
