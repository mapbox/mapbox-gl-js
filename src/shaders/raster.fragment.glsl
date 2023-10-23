#include "_prelude_fog.fragment.glsl"
#include "_prelude_lighting.glsl"

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

#ifdef RASTER_COLOR
uniform sampler2D u_color_ramp;
uniform highp vec2 u_colorization_scale;
uniform highp vec4 u_colorization_mix;

highp vec4 colormap (highp float value) {
  highp float scaled_value = value * u_colorization_scale.y + u_colorization_scale.x;
  highp vec2 coords = vec2(scaled_value, 0.5);
  return texture2D(u_color_ramp, coords);
}
#endif

void main() {

    // read and cross-fade colors from the main and parent tiles
    vec4 color0 = texture2D(u_image0, v_pos0);
    vec4 color1 = texture2D(u_image1, v_pos1);

    vec4 color;

#ifdef RASTER_COLOR
    // In the case of raster colorization, interpolate the raster value first,
    // then sample the color map. Otherwise we interpolate two tabulated colors
    // and end up with a color *not* on the color map.
    highp vec4 fadedColor = mix(color0, color1, u_fade_t);
    color = colormap(dot(vec4(fadedColor.rgb, 1), u_colorization_mix));

    // Apply input alpha on top of color ramp alpha
    color.a *= fadedColor.a;

    if (color.a > 0.0) {
      color.rgb /= color.a;
    }
#else
    if (color0.a > 0.0) {
        color0.rgb /= color0.a;
    }
    if (color1.a > 0.0) {
        color1.rgb /= color1.a;
    }
    color = mix(color0, color1, u_fade_t);
#endif


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

#ifdef LIGHTING_3D_MODE
    out_color = apply_lighting_ground(out_color);
#endif
#ifdef FOG
    out_color = fog_dither(fog_apply(out_color, v_fog_pos));
#endif

    gl_FragColor = vec4(out_color * color.a, color.a);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
