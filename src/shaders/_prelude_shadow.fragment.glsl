#ifdef RENDER_SHADOWS

uniform sampler2D u_shadowmap_0;
uniform sampler2D u_shadowmap_1;
uniform float u_shadow_intensity;
uniform float u_texel_size;
uniform vec2 u_cascade_distances;

highp float shadow_sample_1(highp vec2 uv, highp float compare) {
    return step(unpack_depth(texture2D(u_shadowmap_1, uv)), compare);
}

highp float shadow_sample_0(highp vec2 uv, highp float compare) {
    return step(unpack_depth(texture2D(u_shadowmap_0, uv)), compare);
}

highp float shadow_occlusion_1(highp vec4 pos, float bias) {
    pos.xyz /= pos.w;
    pos.xy = pos.xy * 0.5 + 0.5;
    highp float fragDepth = min(pos.z, 0.999) - bias;
    return shadow_sample_1(pos.xy, fragDepth);
}

highp float shadow_occlusion_0(highp vec4 pos, float bias) {
    pos.xyz /= pos.w;
    pos.xy = pos.xy * 0.5 + 0.5;
    highp float fragDepth = min(pos.z, 0.999) - bias;
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

    highp float o00 = shadow_sample_0(uv00, fragDepth);
    highp float o10 = shadow_sample_0(uv10, fragDepth);
    highp float o20 = shadow_sample_0(uv20, fragDepth);
    highp float o30 = shadow_sample_0(uv30, fragDepth);

    highp float o01 = shadow_sample_0(uv01, fragDepth);
    highp float o11 = shadow_sample_0(uv11, fragDepth);
    highp float o21 = shadow_sample_0(uv21, fragDepth);
    highp float o31 = shadow_sample_0(uv31, fragDepth);

    highp float o02 = shadow_sample_0(uv02, fragDepth);
    highp float o12 = shadow_sample_0(uv12, fragDepth);
    highp float o22 = shadow_sample_0(uv22, fragDepth);
    highp float o32 = shadow_sample_0(uv32, fragDepth);

    highp float o03 = shadow_sample_0(uv03, fragDepth);
    highp float o13 = shadow_sample_0(uv13, fragDepth);
    highp float o23 = shadow_sample_0(uv23, fragDepth);
    highp float o33 = shadow_sample_0(uv33, fragDepth);

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

vec3 shadowed_color_normal(
    vec3 color, vec3 N, vec3 L, vec4 light_view_pos0, vec4 light_view_pos1, float view_depth) {
    float NDotL = dot(N, L);
    if (NDotL < 0.0)
        return color * (1.0 - u_shadow_intensity);

    NDotL = clamp(NDotL, 0.0, 1.0);
    float bias = mix(0.02, 0.008, NDotL);
    float occlusion = 0.0;
    if (view_depth < u_cascade_distances.x)
        occlusion = shadow_occlusion_0(light_view_pos0, bias);
    else if (view_depth < u_cascade_distances.y)
        occlusion = shadow_occlusion_1(light_view_pos1, bias);

    float backfacing = 1.0 - smoothstep(0.0, 0.1, NDotL);
    occlusion = mix(occlusion, 1.0, backfacing);
    color *= 1.0 - (u_shadow_intensity * occlusion);
    return color;
}

vec3 shadowed_color(vec3 color, vec4 light_view_pos0, vec4 light_view_pos1, float view_depth) {
    float bias = 0.0;
    float occlusion = 0.0;
    if (view_depth < u_cascade_distances.x)
        occlusion = shadow_occlusion_0(light_view_pos0, bias);
    else if (view_depth < u_cascade_distances.y)
        occlusion = shadow_occlusion_1(light_view_pos1, bias);

    color *= 1.0 - (u_shadow_intensity * occlusion);
    return color;
}

#endif
