#include "_prelude_fog.fragment.glsl"
#include "_prelude_lighting.glsl"
#include "_prelude_raster_array.glsl"

uniform float u_fade_t;
uniform float u_opacity;
uniform highp float u_raster_elevation;
uniform highp float u_zoom_transition;

in vec2 v_pos0;
in vec2 v_pos1;
in float v_depth;
#ifdef PROJECTION_GLOBE_VIEW
in float v_split_fade;
#endif

uniform float u_brightness_low;
uniform float u_brightness_high;

uniform float u_saturation_factor;
uniform float u_contrast_factor;
uniform vec3 u_spin_weights;

uniform float u_emissive_strength;

#ifndef RASTER_ARRAY
// Since samplers cannot be used as function parameters, they must be hard-coded. These
// are therefore instead moved to the raster_array prelude when raster arrays are active.
uniform sampler2D u_image0;
uniform sampler2D u_image1;
#endif

#ifdef RASTER_COLOR
uniform sampler2D u_color_ramp;
uniform highp vec4 u_colorization_mix;
uniform highp float u_colorization_offset;
uniform vec2 u_texture_res;
#endif


void main() {
    vec4 color0, color1, color;
    vec2 value;

#ifdef RASTER_COLOR

#ifdef RASTER_ARRAY
    // For raster-arrays, we take extra care to decode values strictly correctly,
    // reimplementing linear interpolation in-shader, if necessary.
#ifdef RASTER_ARRAY_LINEAR
    value = mix(
        raTexture2D_image0_linear(v_pos0, u_texture_res, u_colorization_mix, u_colorization_offset),
        raTexture2D_image1_linear(v_pos1, u_texture_res, u_colorization_mix, u_colorization_offset),
        u_fade_t
    );
#else
    value = mix(
        raTexture2D_image0_nearest(v_pos0, u_texture_res, u_colorization_mix, u_colorization_offset),
        raTexture2D_image1_nearest(v_pos1, u_texture_res, u_colorization_mix, u_colorization_offset),
        u_fade_t
    );
#endif
    // Divide the scalar value by "alpha" to smoothly fade to no data
    if (value.y > 0.0) value.x /= value.y;
#else
    color = mix(texture(u_image0, v_pos0), texture(u_image1, v_pos1), u_fade_t);
    value = vec2(u_colorization_offset + dot(color.rgb, u_colorization_mix.rgb), color.a);
#endif

    color = texture(u_color_ramp, vec2(value.x, 0.5));

    // Apply input alpha on top of color ramp alpha
    if (color.a > 0.0) color.rgb /= color.a;

    color.a *= value.y;

#else
    // read and cross-fade colors from the main and parent tiles
    color0 = texture(u_image0, v_pos0);
    color1 = texture(u_image1, v_pos1);

    if (color0.a > 0.0) color0.rgb /= color0.a;
    if (color1.a > 0.0) color1.rgb /= color1.a;
    color = mix(color0, color1, u_fade_t);
#endif

    color.a *= u_opacity;
#ifdef GLOBE_POLES
    color.a *= 1.0 - smoothstep(0.0, 0.05, u_zoom_transition);
#endif
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
    out_color = apply_lighting_with_emission_ground(vec4(out_color, 1.0), u_emissive_strength).rgb;
#endif
#ifdef FOG
    highp float fog_limit_high_meters = 1000000.0;
    highp float fog_limit_low_meters = 600000.0;
    float fog_limit = 1.0 - smoothstep(fog_limit_low_meters, fog_limit_high_meters, u_raster_elevation);
    out_color = fog_dither(fog_apply(out_color, v_fog_pos, fog_limit));
#endif

    glFragColor = vec4(out_color * color.a, color.a);
#ifdef PROJECTION_GLOBE_VIEW
    glFragColor *= mix(1.0, 1.0 - smoothstep(0.0, 0.05, u_zoom_transition), smoothstep(0.8, 0.9, v_split_fade));
#endif

#ifdef RENDER_CUTOFF
    glFragColor = glFragColor * cutoff_opacity(u_cutoff_params, v_depth);
#endif

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
