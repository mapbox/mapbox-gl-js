#include "_prelude_fog.fragment.glsl"
#include "_prelude_lighting.glsl"
#include "_prelude_shadow.fragment.glsl"

uniform lowp float u_device_pixel_ratio;
uniform highp float u_width_scale;
uniform highp float u_floor_width_scale;
uniform float u_alpha_discard_threshold;
uniform highp vec2 u_trim_offset;
uniform highp vec2 u_trim_fade_range;
uniform lowp vec4 u_trim_color;

in vec2 v_width2;
in vec2 v_normal;
in float v_gamma_scale;
in highp vec3 v_uv;
#ifdef ELEVATED_ROADS
in highp float v_road_z_offset;
#endif
#ifdef RENDER_LINE_DASH
uniform sampler2D u_dash_image;

in vec2 v_tex;
#endif

#ifdef RENDER_LINE_GRADIENT
uniform sampler2D u_gradient_image;
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

float luminance(vec3 c) {
    // Digital ITU BT.601 (Y = 0.299 R + 0.587 G + 0.114 B) approximation
    return (c.r + c.r + c.b + c.g + c.g + c.g) * 0.1667;
}

uniform float u_emissive_strength;

#pragma mapbox: define highp vec4 color
#pragma mapbox: define lowp float floorwidth
#pragma mapbox: define lowp vec4 dash
#pragma mapbox: define lowp float blur
#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp float border_width
#pragma mapbox: define lowp vec4 border_color

float linearstep(float edge0, float edge1, float x) {
    return  clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

void main() {
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize lowp float floorwidth
    #pragma mapbox: initialize lowp vec4 dash
    #pragma mapbox: initialize lowp float blur
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize lowp float border_width
    #pragma mapbox: initialize lowp vec4 border_color

    // Calculate the distance of the pixel from the line in pixels.
    float dist = length(v_normal) * v_width2.s;

    // Calculate the antialiasing fade factor. This is either when fading in
    // the line in case of an offset line (v_width2.t) or when fading out
    // (v_width2.s)
    float blur2 = (u_width_scale * blur + 1.0 / u_device_pixel_ratio) * v_gamma_scale;
    float alpha = clamp(min(dist - (v_width2.t - blur2), v_width2.s - dist) / blur2, 0.0, 1.0);
#ifdef RENDER_LINE_DASH
    float sdfdist = texture(u_dash_image, v_tex).r;
    float sdfgamma = 1.0 / (2.0 * u_device_pixel_ratio) / dash.z;
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
        out_color = mix(out_color, u_trim_color, transition_factor);
        trim_alpha = 1.0 - transition_factor;
    }
#endif

    if (u_alpha_discard_threshold != 0.0) {
        if (alpha < u_alpha_discard_threshold) {
            discard;
        }
    }

#ifdef RENDER_LINE_BORDER
    float edgeBlur = ((border_width * u_width_scale) + 1.0 / u_device_pixel_ratio);
    float alpha2 = clamp(min(dist - (v_width2.t - edgeBlur), v_width2.s - dist) / edgeBlur, 0.0, 1.0);
    if (alpha2 < 1.) {
        float smoothAlpha = smoothstep(0.6, 1.0, alpha2);
        if (border_color.a == 0.0) {
            float Y = (out_color.a > 0.01) ? luminance(out_color.rgb / out_color.a) : 1.; // out_color is premultiplied
            float adjustment = (Y > 0.) ? 0.5 / Y : 0.45;
            if (out_color.a > 0.25 && Y < 0.25) {
                vec3 borderColor = (Y > 0.) ? out_color.rgb : vec3(1, 1, 1) * out_color.a;
                out_color.rgb = out_color.rgb + borderColor * (adjustment * (1.0 - smoothAlpha));
            } else {
                out_color.rgb *= (0.6  + 0.4 * smoothAlpha);
            }
        } else {
            out_color = mix(border_color * trim_alpha, out_color, smoothAlpha);
        }
    }
#endif

#ifdef LIGHTING_3D_MODE
    out_color = apply_lighting_with_emission_ground(out_color, u_emissive_strength);
#ifdef RENDER_SHADOWS
    float light = shadowed_light_factor(v_pos_light_view_0, v_pos_light_view_1, v_depth);
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

    out_color *= (alpha * opacity);

#ifdef INDICATOR_CUTOUT
    out_color = applyCutout(out_color, v_z_offset);
#endif

    glFragColor = out_color;

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
