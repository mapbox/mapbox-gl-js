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

    highp vec2 texel = pos.xy / u_texel_size - vec2(0.5);
    highp vec2 f = fract(texel);

    highp float s = u_texel_size;

    // Perform percentage-closer filtering with a 2x2 sample grid.
    // Edge tap smoothing is used to weight each sample based on their contribution in the overall PCF kernel
#ifdef TEXTURE_GATHER
    // sample at the position between 4 texels
    highp vec2 uv00 = (texel - f + 0.5) * s;
    highp vec4 samples = textureGather(u_shadowmap_0, uv00, 0);
    highp vec4 stepSamples = step(samples, vec4(compare0));
#else
    highp vec2 uv00 = (texel - f + 0.5) * s;
    highp vec2 uv10 = uv00 + vec2(1.0 * s, 0.0);
    highp vec2 uv01 = uv00 + vec2(0.0, 1.0 * s);
    highp vec2 uv11 = uv01 + vec2(1.0 * s, 0.0);

    highp vec4 stepSamples = vec4(
        shadow_sample_0(uv01, compare0),
        shadow_sample_0(uv11, compare0),
        shadow_sample_0(uv10, compare0),
        shadow_sample_0(uv00, compare0)
    );
#endif
    // Edge tap smoothing
    vec4 v0 = vec4(1.0 - f.x, f.x, f.x, 1.0 - f.x);
    vec4 v1 = vec4(f.y, f.y, 1.0 - f.y, 1.0 - f.y);

    return clamp(dot(v0 * v1, stepSamples), 0.0, 1.0);
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
    float NDotL = dot(N, u_shadow_direction);

    float bias = calculate_shadow_bias(NDotL);
    float occlusion = shadow_occlusion(light_view_pos0, light_view_pos1, view_depth, bias);

    return mix(0.0, (1.0 - (u_shadow_intensity * occlusion)) * NDotL, step(0.0, NDotL));
}

float shadowed_light_factor_normal_unbiased(vec3 N, highp vec4 light_view_pos0, highp vec4 light_view_pos1, float view_depth) {
    float NDotL = dot(N, u_shadow_direction);

    float bias = 0.0;
    float occlusion = shadow_occlusion(light_view_pos0, light_view_pos1, view_depth, bias);

    return mix(0.0, (1.0 - (u_shadow_intensity * occlusion)) * NDotL, step(0.0, NDotL));
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
