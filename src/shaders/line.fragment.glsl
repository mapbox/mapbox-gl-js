#include "_prelude_fog.fragment.glsl"
#include "_prelude_lighting.glsl"
#include "_prelude_shadow.fragment.glsl"

uniform lowp float u_device_pixel_ratio;
uniform highp float u_width_scale;
uniform float u_alpha_discard_threshold;
uniform lowp float u_opacity_multiplier;
uniform bool u_clip_to_tile_borders;

in vec4 v_width2_dilute;
in vec2 v_normal;
in float v_gamma_scale;
in vec2 v_tile_pos;

#ifdef ELEVATED_ROADS
in highp float v_road_z_offset;
#endif
#ifdef VARIABLE_LINE_WIDTH
in float stub_side;
#endif

#ifdef RENDER_LINE_DASH
uniform sampler2D u_dash_image;
uniform highp float u_floor_width_scale;

in vec2 v_tex;
#endif

#ifdef DEBUG_ELEVATION_ID
in vec3 v_elevation_id_col;
#endif

#if defined(RENDER_LINE_GRADIENT) || defined(RENDER_LINE_TRIM_OFFSET)
in highp vec3 v_uv;
#endif

#ifdef RENDER_LINE_GRADIENT
uniform sampler2D u_gradient_image;
#endif

#ifdef RENDER_LINE_TRIM_OFFSET
uniform highp vec2 u_trim_offset;
uniform highp vec2 u_trim_fade_range;
uniform highp vec2 u_trim_gradient_mix_range;
uniform lowp vec4 u_trim_color;
#endif

#ifdef INDICATOR_CUTOUT
in highp float v_z_offset;
#endif

#ifdef RENDER_SHADOWS
uniform bool u_emissive_in_shadows;
uniform vec3 u_ground_shadow_factor;

in highp vec4 v_pos_light_view_0;
in highp vec4 v_pos_light_view_1;
in highp float v_depth;
#endif

float luminance(vec3 c) {
    // Digital ITU BT.601 (Y = 0.299 R + 0.587 G + 0.114 B) approximation
    return (c.r + c.r + c.b + c.g + c.g + c.g) * 0.1667;
}

#pragma mapbox: define highp vec4 color
#pragma mapbox: define lowp float floorwidth
#pragma mapbox: define mediump uvec4 dash
#pragma mapbox: define lowp float blur
#pragma mapbox: define lowp float opacity
#pragma mapbox: define mediump float side_z_offset
#pragma mapbox: define lowp float border_width
#pragma mapbox: define lowp vec4 border_color
#pragma mapbox: define lowp float emissive_strength

float linearstep(float edge0, float edge1, float x) {
    return  clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

void main() {
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize lowp float floorwidth
    #pragma mapbox: initialize mediump uvec4 dash
    #pragma mapbox: initialize lowp float blur
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize mediump float side_z_offset
    #pragma mapbox: initialize lowp float border_width
    #pragma mapbox: initialize lowp vec4 border_color
    #pragma mapbox: initialize lowp float emissive_strength

    // Calculate the distance of the pixel from the line in pixels.
    float dist = length(v_normal) * v_width2_dilute.x;

    // The distance over which the line edge fades out.
    // Note: the same ANTIALIASING value is used in the line vertex shader.
    float ANTIALIASING = 1.0 / u_device_pixel_ratio / 2.0;
#ifdef RENDER_LINE_BORDER
#ifndef VARIABLE_LINE_WIDTH
    ANTIALIASING *= 8.0;
#endif
#endif

    // Calculate the antialiasing fade factor. This is either when fading in
    // the line in case of an offset line (v_width2_dilute.y) or when fading out
    // (v_width2_dilute.x)
#ifdef VARIABLE_LINE_WIDTH
    blur = mix(blur, 0.0, stub_side);
#endif

    float diluted_opacity = opacity * v_width2_dilute.z;

    // Compute blur alpha factor.   
    float blur2 = (u_width_scale * blur + 1.0 / u_device_pixel_ratio) * v_gamma_scale;
    float alpha = clamp(min(dist - (v_width2_dilute.y - blur2), v_width2_dilute.x - dist) / blur2, 0.0, 1.0);

    float pxStep;
    float delta;
#ifdef RENDER_LINE_BORDER
#ifndef VARIABLE_LINE_WIDTH
    // Calculate the rate of change of the distance across the line.
    pxStep = fwidth(dist);
    // Find the distance to the closer edge of the line.
    // Note: outset (v_width2_dilute.x) and inset (v_width2_dilute.y) are computed in the
    // line vertex shader with an extra ANTIALIASING gap. Take this into account when
    // finding the exact inner and outer edge positions.
    float out_edge = v_width2_dilute.x - dist;
    float in_edge = dist - (v_width2_dilute.y - 2.0 * ANTIALIASING);
    delta = v_width2_dilute.y > 0.0 ? min(in_edge, out_edge) : out_edge;
    // Compute distance based anti-aliasing alpha factor to smooth line edges.
    float edge = ANTIALIASING;
    alpha = delta > 0.0 ? smoothstep(edge - pxStep, u_width_scale * blur + edge + pxStep, delta) : 0.0;
#endif
#endif

#ifdef RENDER_LINE_DASH
    float sdfdist = texture(u_dash_image, v_tex).r;
    float sdfgamma = ANTIALIASING / (float(dash.z) + float(dash.w) / 65535.0);
    float scaled_floorwidth = (floorwidth * u_floor_width_scale);
    alpha *= linearstep(0.5 - sdfgamma / scaled_floorwidth, 0.5 + sdfgamma / scaled_floorwidth, sdfdist);
#endif

    highp vec4 out_color;
#ifdef RENDER_LINE_GRADIENT
    // For gradient lines, v_uv.xy are the coord specify where the texture will be simpled.
    out_color = texture(u_gradient_image, v_uv.xy);
#else
    out_color = color;
#endif

    float trim_alpha = 1.0;
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
        highp float gradient_trim_color_mix_factor = 0.0;
#ifdef RENDER_LINE_GRADIENT
        gradient_trim_color_mix_factor = smoothstep(u_trim_gradient_mix_range.x, u_trim_gradient_mix_range.y, line_progress);
#endif
        highp vec4 trim_color = mix(u_trim_color, out_color, gradient_trim_color_mix_factor);
        // Note: if u_trim_gradient_mix_range.x < 1.0 the non-trimmed part will use the non-gradient color
        // This sets the usage of line-gradient as a trim-color
        out_color = mix(u_trim_gradient_mix_range.x < 1.0 ? color : out_color, trim_color, transition_factor);
        trim_alpha = 1.0 - transition_factor;
    }
#endif

    if (u_alpha_discard_threshold != 0.0) {
        if (alpha < u_alpha_discard_threshold) {
            discard;
        }
    }

#ifdef RENDER_LINE_BORDER
#ifndef VARIABLE_LINE_WIDTH
    // Compute distance based anti-aliasing alpha factor to smooth line borders.
    float edge2 = border_width * u_width_scale + ANTIALIASING;
    float alpha2 = smoothstep(edge2 - pxStep, edge2 + pxStep, delta);
    if (alpha2 < 1.) {
        if (border_color.a == 0.0) {
#ifndef RENDER_LINE_GRADIENT
            float Y = (out_color.a > 0.01) ? luminance(out_color.rgb / out_color.a) : 1.; // out_color is premultiplied
            float adjustment = (Y > 0.) ? 0.5 / Y : 0.45;
            if (out_color.a > 0.25 && Y < 0.25) {
                vec3 borderColor = (Y > 0.) ? out_color.rgb : vec3(1, 1, 1) * out_color.a;
                out_color.rgb = out_color.rgb + borderColor * (adjustment * (1.0 - alpha2));
            } else {
                out_color.rgb *= (0.6 + 0.4 * alpha2);
            }
#else
            out_color.rgb *= (0.6 + 0.4 * alpha2);
#endif
        } else {
            out_color = mix(border_color * trim_alpha, out_color, alpha2);
        }
        out_color *= v_width2_dilute.w;
    }
#endif
#endif

    vec2 cutout_factors = vec2(0.0);
#ifdef FEATURE_CUTOUT
    cutout_factors = get_cutout_factors(gl_FragCoord);
#endif

#ifdef LIGHTING_3D_MODE
    out_color = apply_lighting_with_emission_ground(out_color, emissive_strength);
#ifdef RENDER_SHADOWS
    float light = shadowed_light_factor(v_pos_light_view_0, v_pos_light_view_1, v_depth);
    light = mix(light, 1.0, cutout_factors.y);
    light = u_emissive_in_shadows ? mix(light, 1.0, emissive_strength) : light;
#ifdef ELEVATED_ROADS
    out_color.rgb *= mix(v_road_z_offset != 0.0 ? u_ground_shadow_factor : vec3(1.0), vec3(1.0), light);
#else
    out_color.rgb *= mix(u_ground_shadow_factor, vec3(1.0), light);
#endif // ELEVATED_ROADS
#endif // RENDER_SHADOWS
#endif // LIGHTING_3D_MODE

#ifdef FOG
    out_color = fog_dither(fog_apply_premultiplied(out_color, v_fog_pos));
#endif

    out_color *= (alpha * diluted_opacity * u_opacity_multiplier);

#ifdef INDICATOR_CUTOUT
    out_color = applyCutout(out_color, v_z_offset);
#endif
#ifdef FEATURE_CUTOUT
    out_color = apply_feature_cutout(out_color, gl_FragCoord, cutout_factors.x);
#endif

#ifdef LINE_BLEND_ADDITIVE
    // In additive blend mode the FBO uses ColorMode.additiveAlphaWeighted ([SRC_ALPHA, ONE, ...]).
    // out_color is fully premultiplied: rgb = C*fa*cov, a = fa*cov
    // (fa = feature colour alpha, cov = AA coverage * opacity).
    //
    // coverage is then SRC_ALPHA weight, and C*fa (feature-premultiplied colour) is the value.
    //
    // Output rgb = color.rgb (= C*fa, before coverage was applied) and alpha = cov
    {
        float cov = alpha * diluted_opacity;
        // color.rgb is the feature-alpha-premultiplied colour before coverage scaling.
        // Recover it by dividing out the coverage factor, so the blend mode can apply it correctly.
        glFragColor = vec4(cov > 0.0 ? out_color.rgb / cov : vec3(0.0), cov);
    }
#else
#ifdef LINE_BLEND_MULTIPLY
    // In multiply blend mode the FBO accumulates per-line multiply factors using
    // ColorMode.multiply ([DST_COLOR, ZERO]).  Each fragment must therefore output
    // the factor by which the background should be scaled for this line at this
    // coverage level:
    //   factor = 1 - a*(1 - C)  (lerp between 1=no-op and C=full multiply)
    // out_color is premultiplied: out_color.rgb = C*a, out_color.a = a, so:
    //   factor.rgb = out_color.rgb + (1.0 - out_color.a)
    // Output alpha=1 so the DST_COLOR blend sees a solid factor with no alpha scaling.
    glFragColor = vec4(out_color.rgb + (1.0 - out_color.a), 1.0);
#else
    glFragColor = out_color;
#endif
#endif
#ifdef DUAL_SOURCE_BLENDING
    glFragColorSrc1 = vec4(vec3(0.0), emissive_strength);
#else
#ifdef USE_MRT1
    out_Target1 = vec4(emissive_strength * glFragColor.a, 0.0, 0.0, glFragColor.a);
#endif
#endif

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(1.0);
#endif

#ifdef DEBUG_ELEVATION_ID
    glFragColor = vec4(v_elevation_id_col, 1.0);
#endif

    if (u_clip_to_tile_borders) {
        if (v_tile_pos.x > 1.0 || v_tile_pos.y > 1.0 || v_tile_pos.x < 0.0 || v_tile_pos.y < 0.0) {
            discard;
        }
    }

    HANDLE_WIREFRAME_DEBUG;
}
