uniform lowp float u_device_pixel_ratio;
uniform sampler2D u_image;
uniform float u_image_height;

varying vec2 v_width2;
varying vec2 v_normal;
varying float v_gamma_scale;
varying highp float v_lineprogress;
varying highp float v_line_clip;
varying highp float v_split_index;

#pragma mapbox: define lowp float blur
#pragma mapbox: define lowp float opacity

void main() {
    #pragma mapbox: initialize lowp float blur
    #pragma mapbox: initialize lowp float opacity

    // Calculate the distance of the pixel from the line in pixels.
    float dist = length(v_normal) * v_width2.s;

    // Calculate the antialiasing fade factor. This is either when fading in
    // the line in case of an offset line (v_width2.t) or when fading out
    // (v_width2.s)
    float blur2 = (blur + 1.0 / u_device_pixel_ratio) * v_gamma_scale;
    float alpha = clamp(min(dist - (v_width2.t - blur2), v_width2.s - dist) / blur2, 0.0, 1.0);

    highp float texel_height = 1.0 / u_image_height;
    highp float half_texel_height = 0.5 * texel_height;
    highp vec2 uv = vec2(
        v_lineprogress / v_line_clip,
        v_split_index * texel_height - half_texel_height);

    // For gradient lines, v_lineprogress is the ratio along the
    // entire line, the gradient ramp is stored in a texture.
    vec4 color = texture2D(u_image, uv);

    gl_FragColor = color * (alpha * opacity);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
