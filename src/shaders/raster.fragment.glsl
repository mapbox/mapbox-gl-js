uniform float u_fade_t;
uniform float u_opacity;
uniform sampler2D u_image0;
uniform sampler2D u_image1;
varying vec2 v_pos0;
varying vec2 v_pos1;

uniform float u_brightness_low;
uniform float u_brightness_high;

uniform float u_saturation_factor;
uniform float u_contrast_factor;
uniform vec3 u_spin_weights;

uniform vec3 u_ambient_color;
uniform vec3 u_sun_color;
uniform vec3 u_sun_dir;
uniform vec3 u_cam_fwd;

#pragma mapbox: define lowp float emissive_strength
#pragma mapbox: define highp vec4 emissive_color

void main() {
    #pragma mapbox: initialize lowp float emissive_strength
    #pragma mapbox: initialize highp vec4 emissive_color
    
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

    vec3 out_color = mix(u_high_vec, u_low_vec, rgb);
    out_color = mix(lighting_model(out_color, u_ambient_color, u_sun_color, u_sun_dir, u_cam_fwd), out_color * emissive_color.rgb, emissive_strength);

#ifdef FOG
    out_color = fog_dither(fog_apply(out_color, v_fog_pos));
#endif

    gl_FragColor = vec4(out_color * color.a, color.a);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
