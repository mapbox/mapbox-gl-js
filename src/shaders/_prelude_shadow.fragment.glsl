#ifdef RENDER_SHADOWS

uniform sampler2D u_shadowmap_0;
uniform sampler2D u_shadowmap_1;
uniform float u_shadow_intensity;
uniform float u_texel_size;
uniform vec2 u_cascade_distances;

float shadow_sample_1(vec2 uv, float compare) {
    return step(unpack_depth(texture2D(u_shadowmap_1, uv)), compare);
}

float shadow_sample_0(vec2 uv, float compare) {
    return step(unpack_depth(texture2D(u_shadowmap_0, uv)), compare);
}

float shadow_occlusion_1(vec4 pos, float bias) {
    pos.xyz /= pos.w;
    pos.xy = pos.xy * 0.5 + 0.5;
    float fragDepth = min(pos.z, 0.999) - bias;
    return shadow_sample_1(pos.xy, fragDepth);
}

float shadow_occlusion_0(vec4 pos, float bias) {
    pos.xyz /= pos.w;
    pos.xy = pos.xy * 0.5 + 0.5;
    float fragDepth = min(pos.z, 0.999) - bias;
    vec2 uv = pos.xy;

    vec2 texel = uv / u_texel_size - vec2(1.5);
    vec2 f = fract(texel);

    float s = u_texel_size;

    // brute force sampling
    vec2 uv00 = (texel - f + 0.5) * s;
    vec2 uv10 = uv00 + vec2(1.0 * s, 0);
    vec2 uv20 = uv00 + vec2(2.0 * s, 0);
    vec2 uv30 = uv00 + vec2(3.0 * s, 0);

    vec2 uv01 = uv00 + vec2(0.0, 1.0 * s);
    vec2 uv11 = uv01 + vec2(1.0 * s, 0);
    vec2 uv21 = uv01 + vec2(2.0 * s, 0);
    vec2 uv31 = uv01 + vec2(3.0 * s, 0);

    vec2 uv02 = uv01 + vec2(0.0, 1.0 * s);
    vec2 uv12 = uv02 + vec2(1.0 * s, 0);
    vec2 uv22 = uv02 + vec2(2.0 * s, 0);
    vec2 uv32 = uv02 + vec2(3.0 * s, 0);

    vec2 uv03 = uv02 + vec2(0.0, 1.0 * s);
    vec2 uv13 = uv03 + vec2(1.0 * s, 0);
    vec2 uv23 = uv03 + vec2(2.0 * s, 0);
    vec2 uv33 = uv03 + vec2(3.0 * s, 0);

    float o00 = shadow_sample_0(uv00, fragDepth);
    float o10 = shadow_sample_0(uv10, fragDepth);
    float o20 = shadow_sample_0(uv20, fragDepth);
    float o30 = shadow_sample_0(uv30, fragDepth);

    float o01 = shadow_sample_0(uv01, fragDepth);
    float o11 = shadow_sample_0(uv11, fragDepth);
    float o21 = shadow_sample_0(uv21, fragDepth);
    float o31 = shadow_sample_0(uv31, fragDepth);

    float o02 = shadow_sample_0(uv02, fragDepth);
    float o12 = shadow_sample_0(uv12, fragDepth);
    float o22 = shadow_sample_0(uv22, fragDepth);
    float o32 = shadow_sample_0(uv32, fragDepth);

    float o03 = shadow_sample_0(uv03, fragDepth);
    float o13 = shadow_sample_0(uv13, fragDepth);
    float o23 = shadow_sample_0(uv23, fragDepth);
    float o33 = shadow_sample_0(uv33, fragDepth);

    // Edge tap smoothing
    float value = 
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
    float NDotL = clamp(dot(N, L), 0.0, 1.0);
    float bias = mix(0.02, 0.008, NDotL);
    float occlusion = 0.0;
    if (view_depth < u_cascade_distances.x)
        occlusion = shadow_occlusion_0(light_view_pos0, bias);
    else if (view_depth < u_cascade_distances.y)
        occlusion = shadow_occlusion_1(light_view_pos1, bias);

    float backfacing = 1.0 - smoothstep(0.0, 0.1, NDotL);
    occlusion = mix(occlusion, 1.0, backfacing);
    color *= mix(1.0, 1.0 - u_shadow_intensity, occlusion);
    return color;
}

vec3 shadowed_color(vec3 color, vec4 light_view_pos0, vec4 light_view_pos1, float view_depth) {
    float bias = 0.002;
    float occlusion = 0.0;
    if (view_depth < u_cascade_distances.x)
        occlusion = shadow_occlusion_0(light_view_pos0, bias);
    else if (view_depth < u_cascade_distances.y)
        occlusion = shadow_occlusion_1(light_view_pos1, bias);

    color *= mix(1.0, 1.0 - u_shadow_intensity, occlusion);
    return color;
}

#endif
