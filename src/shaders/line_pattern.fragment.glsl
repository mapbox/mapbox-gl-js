uniform lowp float u_device_pixel_ratio;
uniform vec2 u_texsize;
uniform float u_tile_units_to_pixels;

uniform sampler2D u_image;

varying vec2 v_normal;
varying vec2 v_width2;
varying float v_linesofar;
varying float v_gamma_scale;
varying float v_width;

#pragma mapbox: define lowp vec4 pattern
#pragma mapbox: define lowp float pixel_ratio
#pragma mapbox: define lowp float blur
#pragma mapbox: define lowp float opacity

void main() {
    #pragma mapbox: initialize mediump vec4 pattern
    #pragma mapbox: initialize lowp float pixel_ratio

    #pragma mapbox: initialize lowp float blur
    #pragma mapbox: initialize lowp float opacity

    vec2 pattern_tl = pattern.xy;
    vec2 pattern_br = pattern.zw;

    vec2 display_size = (pattern_br - pattern_tl) / pixel_ratio;

    vec2 pattern_size = vec2(display_size.x / u_tile_units_to_pixels, display_size.y);

    float aspect = display_size.y / v_width;

    // Calculate the distance of the pixel from the line in pixels.
    float dist = length(v_normal) * v_width2.s;

    // Calculate the antialiasing fade factor. This is either when fading in
    // the line in case of an offset line (v_width2.t) or when fading out
    // (v_width2.s)
    float blur2 = (blur + 1.0 / u_device_pixel_ratio) * v_gamma_scale;
    float alpha = clamp(min(dist - (v_width2.t - blur2), v_width2.s - dist) / blur2, 0.0, 1.0);

    float x = mod(v_linesofar / pattern_size.x * aspect, 1.0);

    float y = 0.5 * v_normal.y + 0.5;

    vec2 texel_size = 1.0 / u_texsize;

    vec2 pos = mix(pattern_tl * texel_size - texel_size, pattern_br * texel_size + texel_size, vec2(x, y));
    vec4 color = texture2D(u_image, pos);

#ifdef LIGHTING_3D_MODE
    color = apply_lighting(color);
#endif
#ifdef FOG
    color = fog_dither(fog_apply_premultiplied(color, v_fog_pos));
#endif

    gl_FragColor = color * (alpha * opacity);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
