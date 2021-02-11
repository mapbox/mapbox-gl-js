uniform float u_fade_t;
uniform float u_opacity;
uniform sampler2D u_image0;
uniform sampler2D u_image1;
varying vec2 v_pos0;
varying vec2 v_pos1;
varying vec2 v_pixel_pos;

uniform float u_brightness_low;
uniform float u_brightness_high;

uniform float u_saturation_factor;
uniform float u_contrast_factor;
uniform vec3 u_spin_weights;
uniform vec2 u_center;

void main() {

    // read and cross-fade colors from the main and parent tiles
    vec4 color0 = texture2D(u_image0, v_pos0);
    vec4 color1 = texture2D(u_image1, v_pos1);
    if (color0.a > 0.0) {
        color0.rgb = color0.rgb / color0.a;
    }
    if (color1.a > 0.0) {
        color1.rgb = color1.rgb / color1.a;
    }
    vec4 color = mix(color0, color1, u_fade_t);
    color.a *= u_opacity;
    vec3 rgb = color.rgb;

    // spin
    rgb = vec3(
        dot(rgb, u_spin_weights.xyz),
        dot(rgb, u_spin_weights.zxy),
        dot(rgb, u_spin_weights.yzx));

    // saturation
    float average = (color.r + color.g + color.b) / 3.0;
    rgb += (average - rgb) * u_saturation_factor;

    // contrast
    rgb = (rgb - 0.5) * u_contrast_factor + 0.5;

    // brightness
    vec3 u_high_vec = vec3(u_brightness_low, u_brightness_low, u_brightness_low);
    vec3 u_low_vec = vec3(u_brightness_high, u_brightness_high, u_brightness_high);

    gl_FragColor = vec4(mix(u_high_vec, u_low_vec, rgb) * color.a, color.a);

    #ifndef RENDER_TO_TEXTURE
        highp vec2 center_vec = v_pixel_pos - u_center;
        float center_distance = length(center_vec);
        highp float blur_distance = 50.0 * length(fwidth(center_vec));
        float horizon_start = 2048.0;
        float horizon_end = horizon_start + blur_distance;
        float horizonOpacity = 1.0 - smoothstep(horizon_start, horizon_end, center_distance);
        // gl_FragColor = vec4(horizonOpacity, horizonOpacity, horizonOpacity, horizonOpacity);
        gl_FragColor *= horizonOpacity;
    #endif

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
