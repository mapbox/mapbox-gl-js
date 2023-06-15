#ifdef RENDER_SHADOWS

#if defined(NATIVE) && __VERSION__ >= 300
#define TEXTURE_GATHER
#endif

#ifdef DEPTH_TEXTURE
uniform highp sampler2D u_shadowmap_0;
uniform highp sampler2D u_shadowmap_1;
#else
uniform sampler2D u_shadowmap_0;
uniform sampler2D u_shadowmap_1;
#endif

uniform float u_shadow_intensity;
uniform float u_texel_size;
uniform highp vec3 u_shadow_normal_offset; // [tileToMeter, offsetCascade0, offsetCascade1]
uniform vec2 u_fade_range;
uniform mediump vec3 u_shadow_direction;
uniform highp vec3 u_shadow_bias;

highp float shadow_sample_1(highp vec2 uv, highp float compare) {
    highp float shadow_depth;
#ifdef DEPTH_TEXTURE
    shadow_depth = texture2D(u_shadowmap_1, uv).r;
#else
    shadow_depth = unpack_depth(texture2D(u_shadowmap_1, uv)) * 0.5 + 0.5;
#endif
    return step(shadow_depth, compare);
}

highp float shadow_sample_0(highp vec2 uv, highp float compare) {
    highp float shadow_depth;
#ifdef DEPTH_TEXTURE
    shadow_depth = texture2D(u_shadowmap_0, uv).r;
#else
    shadow_depth = unpack_depth(texture2D(u_shadowmap_0, uv)) * 0.5 + 0.5;
#endif
    return step(shadow_depth, compare);
}

highp float shadow_occlusion_1(highp vec4 pos, highp float bias) {
    highp float compare1 = pos.z - bias;

    highp vec2 texel = pos.xy / u_texel_size - vec2(0.5);
    highp vec2 f = fract(texel);

    highp float s = u_texel_size;

    // Perform percentage-closer filtering with a 2x2 sample grid.
    // Edge tap smoothing is used to weight each sample based on their contribution in the overall PCF kernel
#ifdef TEXTURE_GATHER
    // sample at the position between 4 texels
    vec2 uv00 = (texel - f + 0.5) * s;
    highp vec4 d00 = textureGather(u_shadowmap_1, uv00, 0);
    highp vec4 c00 = step(d00, vec4(compare1));
    highp float o00 = c00.a;
    highp float o10 = c00.b;
    highp float o01 = c00.r;
    highp float o11 = c00.g;
#else
    highp vec2 uv00 = (texel - f + 0.5) * s;
    highp vec2 uv10 = uv00 + vec2(1.0 * s, 0.0);

    highp vec2 uv01 = uv00 + vec2(0.0, 1.0 * s);
    highp vec2 uv11 = uv01 + vec2(1.0 * s, 0.0);
    highp float o00 = shadow_sample_1(uv00, compare1);
    highp float o10 = shadow_sample_1(uv10, compare1);

    highp float o01 = shadow_sample_1(uv01, compare1);
    highp float o11 = shadow_sample_1(uv11, compare1);
#endif
    // Edge tap smoothing
    highp float value = 
        (1.0 - f.x) * (1.0 - f.y) * o00 +
        f.x * (1.0 - f.y) * o10 +
        (1.0 - f.x) * f.y * o01 +
        f.x * f.y * o11;

    return clamp(value, 0.0, 1.0);
}

highp float shadow_occlusion_0(highp vec4 pos, highp float bias) {
    highp float compare0 = pos.z - bias;

    highp vec2 texel = pos.xy / u_texel_size - vec2(1.5);
    highp vec2 f = fract(texel);

    highp float s = u_texel_size;

    // Perform brute force percentage-closer filtering with a 4x4 sample grid.
    // Edge tap smoothing is used to weight each sample based on their contribution in the overall PCF kernel
#ifdef TEXTURE_GATHER
    // sample at the position between 4 texels, with offset of 2 horizontally and vertically.
    highp vec2 uv00 = (texel - f + 0.5) * s;
    highp vec2 uv10 = uv00 + vec2(2.0 * s, 0);
    highp vec2 uv01 = uv00 + vec2(0, 2.0 * s);
    highp vec2 uv11 = uv10 + vec2(0, 2.0 * s);

    highp vec4 d00 = textureGather(u_shadowmap_0, uv00);
    highp vec4 d10 = textureGather(u_shadowmap_0, uv10);
    highp vec4 d01 = textureGather(u_shadowmap_0, uv01);
    highp vec4 d11 = textureGather(u_shadowmap_0, uv11);
    highp vec4 c00 = step(d00, vec4(compare0));
    highp vec4 c01 = step(d01, vec4(compare0));
    highp vec4 c10 = step(d10, vec4(compare0));
    highp vec4 c11 = step(d11, vec4(compare0));
    highp float o00 = c00.a;
    highp float o10 = c00.b;
    highp float o20 = c10.a;
    highp float o30 = c10.b;

    highp float o01 = c00.r;
    highp float o11 = c00.g;
    highp float o21 = c10.r;
    highp float o31 = c10.g;

    highp float o02 = c01.a;
    highp float o12 = c01.b;
    highp float o22 = c11.a;
    highp float o32 = c11.b;

    highp float o03 = c01.r;
    highp float o13 = c01.g;
    highp float o23 = c11.r;
    highp float o33 = c11.g;
#else
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
#endif
    // Edge tap smoothing
    highp float value = 
        (1.0 - f.x) * (1.0 - f.y) * o00 +
        (1.0 - f.y) * (o10 + o20) +
        f.x * (1.0 - f.y) * o30 +
        (1.0 - f.x) * (o01 + o02) +
        f.x * (o31 + o32) +
        (1.0 - f.x) * f.y * o03 +
        f.y * (o13 + o23) +
        f.x * f.y * o33 +
        o11 + o21 + o12 + o22;

    return clamp(value / 9.0, 0.0, 1.0);
}

float shadow_occlusion(highp vec4 light_view_pos0, highp vec4 light_view_pos1, float view_depth, highp float bias) {
    light_view_pos0.xyz /= light_view_pos0.w;
    light_view_pos1.xyz /= light_view_pos1.w;

    vec4 uv = vec4(light_view_pos0.xy, light_view_pos1.xy);
    vec4 abs_bounds = abs(uv);

    if (abs_bounds.x < 1.0 && abs_bounds.y < 1.0) {
        light_view_pos0.xyz = light_view_pos0.xyz * 0.5 + 0.5;
        return shadow_occlusion_0(light_view_pos0, bias);
    }
    if (abs_bounds.z >= 1.0 || abs_bounds.w >= 1.0) {
        return 0.0;
    }

    light_view_pos1.xyz = light_view_pos1.xyz * 0.5 + 0.5;
    float occlusion1 = shadow_occlusion_1(light_view_pos1, bias);
        
    // If view_depth is within end fade range, fade out
    return mix(occlusion1, 0.0, smoothstep(u_fade_range.x, u_fade_range.y, view_depth));
}

highp float calculate_shadow_bias(float NDotL) {
#ifdef NORMAL_OFFSET
    return 0.5 * u_shadow_bias.x;
#else
    // Slope scale based on http://www.opengl-tutorial.org/intermediate-tutorials/tutorial-16-shadow-mapping/
    return 0.5 * (u_shadow_bias.x + clamp(u_shadow_bias.y * tan(acos(NDotL)), 0.0, u_shadow_bias.z));
#endif
}

float shadowed_light_factor_normal(vec3 N, highp vec4 light_view_pos0, highp vec4 light_view_pos1, float view_depth) {
    highp float NDotL = dot(N, u_shadow_direction);
    if (NDotL < 0.0)
        return 0.0;
    
    highp float bias = calculate_shadow_bias(NDotL);
    float occlusion = shadow_occlusion(light_view_pos0, light_view_pos1, view_depth, bias);

    return (1.0 - (u_shadow_intensity * occlusion)) * NDotL;
}

float shadowed_light_factor_normal_unbiased(vec3 N, highp vec4 light_view_pos0, highp vec4 light_view_pos1, float view_depth) {
    highp float NDotL = dot(N, u_shadow_direction);
    if (NDotL < 0.0)
        return 0.0;

    float bias = 0.0;
    float occlusion = shadow_occlusion(light_view_pos0, light_view_pos1, view_depth, bias);

    return (1.0 - (u_shadow_intensity * occlusion)) * NDotL;
}

float shadowed_light_factor(highp vec4 light_view_pos0, highp vec4 light_view_pos1, float view_depth) {
    float bias = 0.0;
    float occlusion = shadow_occlusion(light_view_pos0, light_view_pos1, view_depth, bias);

    return 1.0 - (u_shadow_intensity * occlusion);
}

float shadow_occlusion(float ndotl, highp vec4 light_view_pos0, highp vec4 light_view_pos1, float view_depth) {
    float bias = calculate_shadow_bias(ndotl);
    return shadow_occlusion(light_view_pos0, light_view_pos1, view_depth, bias);
}

#endif
