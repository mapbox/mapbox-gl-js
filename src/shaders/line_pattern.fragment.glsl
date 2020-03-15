uniform lowp float u_device_pixel_ratio;
uniform vec2 u_texsize;
uniform float u_fade;
uniform mediump vec3 u_scale;

uniform sampler2D u_image;

varying vec2 v_normal;
varying vec2 v_width2;
varying float v_linesofar;
varying float v_gamma_scale;
varying float v_width;

#pragma mapbox: define lowp vec4 pattern_from
#pragma mapbox: define lowp vec4 pattern_to
#pragma mapbox: define lowp float pixel_ratio_from
#pragma mapbox: define lowp float pixel_ratio_to
#pragma mapbox: define lowp float blur
#pragma mapbox: define lowp float opacity

void main() {
    #pragma mapbox: initialize mediump vec4 pattern_from
    #pragma mapbox: initialize mediump vec4 pattern_to
    #pragma mapbox: initialize lowp float pixel_ratio_from
    #pragma mapbox: initialize lowp float pixel_ratio_to

    #pragma mapbox: initialize lowp float blur
    #pragma mapbox: initialize lowp float opacity

    vec2 pattern_tl_a = pattern_from.xy;
    vec2 pattern_br_a = pattern_from.zw;
    vec2 pattern_tl_b = pattern_to.xy;
    vec2 pattern_br_b = pattern_to.zw;

    float tileZoomRatio = u_scale.x;
    float fromScale = u_scale.y;
    float toScale = u_scale.z;

    vec2 display_size_a = (pattern_br_a - pattern_tl_a) / pixel_ratio_from;
    vec2 display_size_b = (pattern_br_b - pattern_tl_b) / pixel_ratio_to;

    vec2 pattern_size_a = vec2(display_size_a.x * fromScale / tileZoomRatio, display_size_a.y);
    vec2 pattern_size_b = vec2(display_size_b.x * toScale / tileZoomRatio, display_size_b.y);

    float aspect_a = display_size_a.y / v_width;
    float aspect_b = display_size_b.y / v_width;

    // Calculate the distance of the pixel from the line in pixels.
    float dist = length(v_normal) * v_width2.s;

    // Calculate the antialiasing fade factor. This is either when fading in
    // the line in case of an offset line (v_width2.t) or when fading out
    // (v_width2.s)
    float blur2 = (blur + 1.0 / u_device_pixel_ratio) * v_gamma_scale;
    float alpha = clamp(min(dist - (v_width2.t - blur2), v_width2.s - dist) / blur2, 0.0, 1.0);

    float x_a = mod(v_linesofar / pattern_size_a.x * aspect_a, 1.0);
    float x_b = mod(v_linesofar / pattern_size_b.x * aspect_b, 1.0);

    float y = 0.5 * v_normal.y + 0.5;

    vec2 texel_size = 1.0 / u_texsize;

    vec2 pos_a = mix(pattern_tl_a * texel_size - texel_size, pattern_br_a * texel_size + texel_size, vec2(x_a, y));
    vec2 pos_b = mix(pattern_tl_b * texel_size - texel_size, pattern_br_b * texel_size + texel_size, vec2(x_b, y));

    vec4 color = mix(texture2D(u_image, pos_a), texture2D(u_image, pos_b), u_fade);

    gl_FragColor = color * alpha * opacity;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
