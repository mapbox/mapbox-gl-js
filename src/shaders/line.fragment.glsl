uniform lowp float u_device_pixel_ratio;
uniform float u_alpha_discard_threshold;
uniform highp vec2 u_trim_offset;

varying vec2 v_width2;
varying vec2 v_normal;
varying float v_gamma_scale;
varying highp vec4 v_uv;
#ifdef RENDER_LINE_DASH
uniform sampler2D u_dash_image;

varying vec2 v_tex;
#endif

#ifdef RENDER_LINE_GRADIENT
uniform sampler2D u_gradient_image;
#endif

uniform float u_border_width;
uniform vec4 u_border_color;
float luminance(vec3 c) {
    // Digital ITU BT.601 (Y = 0.299 R + 0.587 G + 0.114 B) approximation
    return (c.r + c.r + c.b + c.g + c.g + c.g) * 0.1667;
}

#pragma mapbox: define highp vec4 color
#pragma mapbox: define lowp float floorwidth
#pragma mapbox: define lowp vec4 dash
#pragma mapbox: define lowp float blur
#pragma mapbox: define lowp float opacity

float linearstep(float edge0, float edge1, float x) {
    return  clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

void main() {
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize lowp float floorwidth
    #pragma mapbox: initialize lowp vec4 dash
    #pragma mapbox: initialize lowp float blur
    #pragma mapbox: initialize lowp float opacity

    // Calculate the distance of the pixel from the line in pixels.
    float dist = length(v_normal) * v_width2.s;

    // Calculate the antialiasing fade factor. This is either when fading in
    // the line in case of an offset line (v_width2.t) or when fading out
    // (v_width2.s)
    float blur2 = (blur + 1.0 / u_device_pixel_ratio) * v_gamma_scale;
    float alpha = clamp(min(dist - (v_width2.t - blur2), v_width2.s - dist) / blur2, 0.0, 1.0);
#ifdef RENDER_LINE_DASH
    float sdfdist = texture2D(u_dash_image, v_tex).a;
    float sdfgamma = 1.0 / (2.0 * u_device_pixel_ratio) / dash.z;
    alpha *= linearstep(0.5 - sdfgamma / floorwidth, 0.5 + sdfgamma / floorwidth, sdfdist);
#endif

    highp vec4 out_color;
#ifdef RENDER_LINE_GRADIENT
    // For gradient lines, v_uv.xy are the coord specify where the texture will be simpled.
    out_color = texture2D(u_gradient_image, v_uv.xy);
#else
    out_color = color;
#endif

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
            out_color = vec4(0, 0, 0, 0);
        }
    }
#endif

#ifdef LIGHTING_3D_MODE
    out_color = apply_lighting(out_color);
#endif
#ifdef FOG
    out_color = fog_dither(fog_apply_premultiplied(out_color, v_fog_pos));
#endif

#ifdef RENDER_LINE_ALPHA_DISCARD
    if (alpha < u_alpha_discard_threshold) {
        discard;
    }
#endif

#ifdef RENDER_LINE_BORDER
    float edgeBlur = (u_border_width + 1.0 / u_device_pixel_ratio);
    float alpha2 = clamp(min(dist - (v_width2.t - edgeBlur), v_width2.s - dist) / edgeBlur, 0.0, 1.0);
    if (alpha2 < 1.) {
        float smoothAlpha = smoothstep(0.6, 1.0, alpha2);
#ifdef RENDER_LINE_BORDER_AUTO
        float Y = (out_color.a > 0.01) ? luminance(out_color.rgb / out_color.a) : 1.; // out_color is premultiplied
        float adjustment = (Y > 0.) ? 0.5 / Y : 0.45;
        if (out_color.a > 0.25 && Y < 0.25) {
            vec3 borderColor = (Y > 0.) ? out_color.rgb : vec3(1, 1, 1) * out_color.a;
            out_color.rgb = out_color.rgb + borderColor * (adjustment * (1.0 - smoothAlpha));
        } else {
            out_color.rgb *= (0.6  + 0.4 * smoothAlpha);
        }
#else  // use user-provided border color
        out_color.rgb = mix(u_border_color.rgb, out_color.rgb, smoothAlpha);
#endif // RENDER_LINE_BORDER_AUTO
    }
#endif
    gl_FragColor = out_color * (alpha * opacity);


#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
