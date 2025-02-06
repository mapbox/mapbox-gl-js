#ifdef RENDER_SHADOWS

#ifdef DEPTH_TEXTURE
uniform highp sampler2D u_shadowmap_0;
uniform highp sampler2D u_shadowmap_1;
#else
uniform sampler2D u_shadowmap_0;
uniform sampler2D u_shadowmap_1;
#endif

uniform float u_shadow_intensity;
uniform float u_shadow_map_resolution;
uniform float u_shadow_texel_size;
uniform highp vec3 u_shadow_normal_offset; // [tileToMeter, offsetCascade0, offsetCascade1]
uniform vec2 u_fade_range;
uniform mediump vec3 u_shadow_direction;
uniform highp vec3 u_shadow_bias;

highp float shadow_sample_1(highp vec2 uv, highp float compare) {
    highp float shadow_depth;
#ifdef DEPTH_TEXTURE
    shadow_depth = texture(u_shadowmap_1, uv).r;
#else
    shadow_depth = unpack_depth(texture(u_shadowmap_1, uv)) * 0.5 + 0.5;
#endif
    return step(shadow_depth, compare);
}

highp float shadow_sample_0(highp vec2 uv, highp float compare) {
    highp float shadow_depth;
#ifdef DEPTH_TEXTURE
    shadow_depth = texture(u_shadowmap_0, uv).r;
#else
    shadow_depth = unpack_depth(texture(u_shadowmap_0, uv)) * 0.5 + 0.5;
#endif
    return step(shadow_depth, compare);
}

float shadow_occlusion_1(highp vec4 pos, highp float bias) {
    highp vec2 uv = pos.xy;
    return shadow_sample_1(uv, pos.z - bias);
}

float shadow_occlusion_0(highp vec4 pos, highp float bias) {
    highp float compare0 = pos.z - bias;

    // Perform percentage-closer filtering with a 2x2 sample grid.
    // Edge tap smoothing is used to weight each sample based on their contribution in the overall PCF kernel
#ifdef TEXTURE_GATHER
    highp vec2 uv = pos.xy;
    highp vec4 samples = textureGather(u_shadowmap_0, uv, 0);
    lowp vec4 stepSamples = step(samples, vec4(compare0));
#else
    highp vec2 uv00 = pos.xy - vec2(0.5 * u_shadow_texel_size);
    highp vec2 uv10 = uv00 + vec2(u_shadow_texel_size, 0.0);
    highp vec2 uv01 = uv00 + vec2(0.0, u_shadow_texel_size);
    highp vec2 uv11 = uv01 + vec2(u_shadow_texel_size, 0.0);

    lowp vec4 stepSamples = vec4(
        shadow_sample_0(uv01, compare0),
        shadow_sample_0(uv11, compare0),
        shadow_sample_0(uv10, compare0),
        shadow_sample_0(uv00, compare0)
    );
#endif
    // Bilinear interpolation
    vec2 f = fract(pos.xy * u_shadow_map_resolution - vec2(0.5));

    lowp vec2 lerpx = mix(stepSamples.wx, stepSamples.zy, f.xx);
    return mix(lerpx.x, lerpx.y, f.y);
}

float shadow_occlusion(highp vec4 light_view_pos0, highp vec4 light_view_pos1, float view_depth, highp float bias) {
#ifdef SHADOWS_SINGLE_CASCADE
    light_view_pos0.xyz /= light_view_pos0.w;
    vec2 abs_bounds = abs(light_view_pos0.xy);
    if (abs_bounds.x >= 1.0 || abs_bounds.y >= 1.0) {
        return 0.0;
    }
    light_view_pos0.xyz = light_view_pos0.xyz * 0.5 + 0.5;
    return shadow_occlusion_0(light_view_pos0, bias);
#else // SHADOWS_SINGLE_CASCADE

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
#endif  // SHADOWS_SINGLE_CASCADE
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

float shadowed_light_factor_normal_opacity(vec3 N, highp vec4 light_view_pos0, highp vec4 light_view_pos1, float view_depth, float shadow_opacity) {
    float NDotL = dot(N, u_shadow_direction);

    float bias = calculate_shadow_bias(NDotL);
    float occlusion = shadow_occlusion(light_view_pos0, light_view_pos1, view_depth, bias) * shadow_opacity;

    return mix(0.0, (1.0 - (u_shadow_intensity * occlusion)) * NDotL, step(0.0, NDotL));
}

float shadowed_light_factor_normal_unbiased(vec3 N, highp vec4 light_view_pos0, highp vec4 light_view_pos1, float view_depth) {
    float NDotL = dot(N, u_shadow_direction);

    float bias = 0.0;
    float occlusion = shadow_occlusion(light_view_pos0, light_view_pos1, view_depth, bias);

    return mix(0.0, (1.0 - (u_shadow_intensity * occlusion)) * NDotL, step(0.0, NDotL));
}

// from https://archive.org/download/GDC2006Isidoro: Receiver Plane Depth Bias (slides 37 - 41)
highp vec2 compute_receiver_plane_depth_bias(highp vec3 pos_dx, highp vec3 pos_dy)
{
    highp vec2 biasUV = vec2(
        pos_dy.y * pos_dx.z - pos_dx.y * pos_dy.z,
        pos_dx.x * pos_dy.z - pos_dy.x * pos_dx.z);
    biasUV *= 1.0 / ((pos_dx.x * pos_dy.y) - (pos_dx.y * pos_dy.x));
    return biasUV;
}
float shadowed_light_factor_plane_bias(highp vec4 light_view_pos0, highp vec4 light_view_pos1, float view_depth) {
    highp vec3 light_view_pos0_xyz = light_view_pos0.xyz / light_view_pos0.w * 0.5 + 0.5;
    highp vec3 light_view_pos0_ddx = dFdx(light_view_pos0_xyz);
    highp vec3 light_view_pos0_ddy = dFdy(light_view_pos0_xyz);
    highp vec2 plane_depth_bias = compute_receiver_plane_depth_bias(light_view_pos0_ddx, light_view_pos0_ddy);
    highp float bias = dot(vec2(u_shadow_texel_size, u_shadow_texel_size), plane_depth_bias) + 0.0001;

    float occlusion = shadow_occlusion(light_view_pos0, light_view_pos1, view_depth, bias);

    return 1.0 - (u_shadow_intensity * occlusion);
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
