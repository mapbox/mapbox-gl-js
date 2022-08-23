#ifdef RENDER_SHADOWS

uniform sampler2D u_shadowmap_0;
uniform sampler2D u_shadowmap_1;
uniform float u_shadow_intensity;
uniform float u_texel_size;
uniform vec2 u_cascade_distances;
uniform highp vec3 u_shadow_direction;
uniform highp vec3 u_shadow_bias;

#ifdef USE_STANDARD_DERIVATIVES
highp vec2 light_space_derivatives(highp vec3 pos) {
    // Receiver plane depth bias
    // From https://developer.amd.com/wordpress/media/2012/10/Isidoro-ShadowMapping.pdf
    // Derivatives of position in light space w.r.t. screen space x and y
    highp vec3 screen_x_deriv = dFdx(pos);
    highp vec3 screen_y_deriv = dFdy(pos);

    // Calculate derivatives w.r.t. light space x and y
    highp vec2 light_deriv;
    light_deriv.x = (screen_y_deriv.y * screen_x_deriv.z) - (screen_x_deriv.y * screen_y_deriv.z);
    light_deriv.y = (screen_x_deriv.x * screen_y_deriv.z) - (screen_y_deriv.x * screen_x_deriv.z);
    light_deriv *= 1.0 / ((screen_x_deriv.x * screen_y_deriv.y) - (screen_x_deriv.y * screen_y_deriv.x));

    return light_deriv;
}
#endif

highp float shadow_sample_1(highp vec2 uv, highp float compare) {
    return step(unpack_depth(texture2D(u_shadowmap_1, uv)), compare);
}

highp float shadow_sample_0(highp vec2 uv, highp float compare) {
    return step(unpack_depth(texture2D(u_shadowmap_0, uv)), compare);
}

highp float shadow_occlusion_1(highp vec4 pos, highp float bias) {
    pos.xyz /= pos.w;
    pos.xy = pos.xy * 0.5 + 0.5;

    highp vec2 texel = pos.xy / u_texel_size - vec2(0.5);
    highp vec2 f = fract(texel);

    highp vec2 light_deriv;
#ifdef USE_STANDARD_DERIVATIVES
    light_deriv = light_space_derivatives(pos.xyz);
#endif

    highp float s = u_texel_size;

    // Perform percentage-closer filtering with a 2x2 sample grid.
    // Edge tap smoothing is used to weight each sample based on their contribution in the overall PCF kernel

    float samples[4];
    highp vec2 origin = (texel - f + 0.5) * u_texel_size;
    for (float y = 0.0; y < 2.0; y += 1.0) {
        for (float x = 0.0; x < 2.0; x += 1.0) {
            vec2 sample_pos = origin + vec2(x * u_texel_size, y * u_texel_size);

            highp float receiverBias;

#ifdef USE_STANDARD_DERIVATIVES
            vec2 sample_offset = sample_pos - pos.xy;
            receiverBias = (light_deriv.x * sample_offset.x) + (light_deriv.y * sample_offset.y);
#else
            receiverBias = 0.0;
#endif

            highp float compare1 = min(pos.z, 0.999) + receiverBias - bias;
            samples[int(y * 2.0 + x)] = shadow_sample_1(sample_pos, compare1);
        }
    }

    // Edge tap smoothing
    highp float value = 
        (1.0 - f.x) * (1.0 - f.y) * samples[0] +
        f.x * (1.0 - f.y) * samples[1] +
        (1.0 - f.x) * f.y * samples[2] +
        f.x * f.y * samples[3];

    return clamp(value, 0.0, 1.0);
}

highp float shadow_occlusion_0(highp vec4 pos, highp float bias) {
    pos.xyz /= pos.w;
    pos.xy = pos.xy * 0.5 + 0.5;

    highp vec2 texel = pos.xy / u_texel_size - vec2(1.5);
    highp vec2 f = fract(texel);

    highp vec2 light_deriv;
#ifdef USE_STANDARD_DERIVATIVES
    light_deriv = light_space_derivatives(pos.xyz);
#endif

    // Perform shadow filtering with a 4x4 sample grid.
    // Edge tap smoothing is used to weight each sample based on their contribution in the overall PCF kernel,
    // i.e. `weight = clamp(kernel, texel.bounds).area / texel.area`

    float samples[16];
    highp vec2 origin = (texel - f + 0.5) * u_texel_size;
    for (float y = 0.0; y < 4.0; y += 1.0) {
        for (float x = 0.0; x < 4.0; x += 1.0) {
            vec2 sample_pos = origin + vec2(x * u_texel_size, y * u_texel_size);

            highp float receiverBias;

#ifdef USE_STANDARD_DERIVATIVES
            vec2 sample_offset = sample_pos - pos.xy;
            receiverBias = (light_deriv.x * sample_offset.x) + (light_deriv.y * sample_offset.y);
#else
            receiverBias = 0.0;
#endif

            highp float compare0 = min(pos.z, 0.999) + receiverBias - bias;
            samples[int(y * 4.0 + x)] = shadow_sample_0(sample_pos, compare0);
        }
    }

    // Edge tap smoothing
    highp float value = 
        (1.0 - f.x) * (1.0 - f.y) * samples[0] +
        (1.0 - f.y) * (samples[1] + samples[2]) +
        f.x * (1.0 - f.y) * samples[3] +
        (1.0 - f.x) * (samples[4] + samples[8]) +
        f.x * (samples[7] + samples[11]) +
        (1.0 - f.x) * f.y * samples[12] +
        f.y * (samples[13] + samples[14]) +
        f.x * f.y * samples[15] +
        samples[5] + samples[6] + samples[9] + samples[10];

    return clamp(value / 9.0, 0.0, 1.0);
}

float shadow_occlusion(highp vec4 light_view_pos0, highp vec4 light_view_pos1, float view_depth, highp float bias) {
    const float cascadeFadeRange = 0.05;
    const float endFadeRange = 0.25;

    float occlusion = 0.0;
    if (view_depth < u_cascade_distances.x) {
        occlusion = shadow_occlusion_0(light_view_pos0, bias);
    }
    if (view_depth > u_cascade_distances.x * (1.0 - cascadeFadeRange) && view_depth < u_cascade_distances.y) {
        float occlusion1 = shadow_occlusion_1(light_view_pos1, bias);

        // If view_depth is within cascade 0 depth, mix the results
        occlusion = (view_depth >= u_cascade_distances.x) ? occlusion1 :
            mix(occlusion1, occlusion, (u_cascade_distances.x - view_depth) / (u_cascade_distances.x * cascadeFadeRange));
        
        // If view_depth is within end fade range, fade out
        if (view_depth > u_cascade_distances.y * (1.0 - endFadeRange)) {
            occlusion *= (u_cascade_distances.y - view_depth) / (u_cascade_distances.y * endFadeRange);
        }
    }

    return occlusion;
}

vec3 shadowed_color_normal(
    vec3 color, highp vec3 N, highp vec4 light_view_pos0, highp vec4 light_view_pos1, float view_depth) {
    highp float NDotL = dot(N, u_shadow_direction);
    if (NDotL < 0.0)
        return color * (1.0 - u_shadow_intensity);

    NDotL = clamp(NDotL, 0.0, 1.0);

    // Slope scale based on http://www.opengl-tutorial.org/intermediate-tutorials/tutorial-16-shadow-mapping/
    highp float bias = u_shadow_bias.x + clamp(u_shadow_bias.y * tan(acos(NDotL)), 0.0, u_shadow_bias.z);
    float occlusion = shadow_occlusion(light_view_pos0, light_view_pos1, view_depth, bias);

    float backfacing = 1.0 - smoothstep(0.0, 0.1, NDotL);
    occlusion = mix(occlusion, 1.0, backfacing);
    color *= 1.0 - (u_shadow_intensity * occlusion);
    return color;
}

vec3 shadowed_color(vec3 color, highp vec4 light_view_pos0, highp vec4 light_view_pos1, float view_depth) {
    float bias = 0.0;
    float occlusion = shadow_occlusion(light_view_pos0, light_view_pos1, view_depth, bias);

    color *= 1.0 - (u_shadow_intensity * occlusion);
    return color;
}

#endif
