#ifdef RENDER_SHADOWS

uniform sampler2D u_shadowmap_0;
uniform sampler2D u_shadowmap_1;
uniform float u_shadow_intensity;
uniform float u_texel_size;
uniform vec2 u_cascade_distances;
uniform highp vec3 u_shadow_direction;
uniform highp vec3 u_shadow_bias;

highp float shadow_sample_1(highp vec2 uv, highp float compare) {
    return step(unpack_depth(texture2D(u_shadowmap_1, uv)), compare);
}

highp float shadow_sample_0(highp vec2 uv, highp float compare) {
    return step(unpack_depth(texture2D(u_shadowmap_0, uv)), compare);
}

highp float shadow_occlusion_1(highp vec4 pos, highp float bias) {
    pos.xyz /= pos.w;
    pos.xy = pos.xy * 0.5 + 0.5;
    highp float compare1 = min(pos.z, 0.999) - bias;
    return shadow_sample_1(pos.xy, compare1);
}

highp float shadow_occlusion_0(highp vec4 pos, highp float bias) {
    pos.xyz /= pos.w;
    pos.xy = pos.xy * 0.5 + 0.5;
    highp float compare0 = min(pos.z, 0.999) - bias;
    highp vec2 uv = pos.xy;

    highp vec2 texel = uv / u_texel_size - vec2(1.5);
    highp vec2 f = fract(texel);

    highp float s = u_texel_size;

    // Perform brute force percentage-closer filtering with a 4x4 sample grid.
    // Edge tap smoothing is used to weight each sample based on their contribution in the overall PCF kernel, i.e. `weight = clamp(kernel, texel.bounds).area / texel.area`
    highp vec2 uv00 = (texel - f + 0.5) * s;
    highp vec2 uv10 = uv00 + vec2(1.0 * s, 0);
    highp vec2 uv20 = uv00 + vec2(2.0 * s, 0);
    highp vec2 uv30 = uv00 + vec2(3.0 * s, 0);

    highp vec2 uv01 = uv00 + vec2(0.0, 1.0 * s);
    highp vec2 uv11 = uv01 + vec2(1.0 * s, 0);
    highp vec2 uv21 = uv01 + vec2(2.0 * s, 0);
    highp vec2 uv31 = uv01 + vec2(3.0 * s, 0);

    highp vec2 uv02 = uv01 + vec2(0.0, 1.0 * s);
    highp vec2 uv12 = uv02 + vec2(1.0 * s, 0);
    highp vec2 uv22 = uv02 + vec2(2.0 * s, 0);
    highp vec2 uv32 = uv02 + vec2(3.0 * s, 0);

    highp vec2 uv03 = uv02 + vec2(0.0, 1.0 * s);
    highp vec2 uv13 = uv03 + vec2(1.0 * s, 0);
    highp vec2 uv23 = uv03 + vec2(2.0 * s, 0);
    highp vec2 uv33 = uv03 + vec2(3.0 * s, 0);

    highp float o00 = shadow_sample_0(uv00, compare0);
    highp float o10 = shadow_sample_0(uv10, compare0);
    highp float o20 = shadow_sample_0(uv20, compare0);
    highp float o30 = shadow_sample_0(uv30, compare0);

    highp float o01 = shadow_sample_0(uv01, compare0);
    highp float o11 = shadow_sample_0(uv11, compare0);
    highp float o21 = shadow_sample_0(uv21, compare0);
    highp float o31 = shadow_sample_0(uv31, compare0);

    highp float o02 = shadow_sample_0(uv02, compare0);
    highp float o12 = shadow_sample_0(uv12, compare0);
    highp float o22 = shadow_sample_0(uv22, compare0);
    highp float o32 = shadow_sample_0(uv32, compare0);

    highp float o03 = shadow_sample_0(uv03, compare0);
    highp float o13 = shadow_sample_0(uv13, compare0);
    highp float o23 = shadow_sample_0(uv23, compare0);
    highp float o33 = shadow_sample_0(uv33, compare0);

    // Edge tap smoothing
    highp float value = 
        (1.0 - f.x) * (1.0 - f.y) * o00 +
        (1.0 - f.y) * (o10 + o20) +
        f.x * (1.0 - f.y) * o30 +
        (1.0 - f.x) * (o01 + o02) +
        f.x * (o31 + o32) +
        (1.0 - f.x) * f.y * o03 +
        f.y * (o13 + o23) +
        f.x * f.x * o33 +
        o11 + o21 + o12 + o22;

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
