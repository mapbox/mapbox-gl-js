#ifdef RENDER_SHADOWS

uniform sampler2D u_shadowmap_0;
uniform sampler2D u_shadowmap_1;
uniform float u_shadow_intensity;
uniform float u_texel_size;
uniform vec3 u_cascade_distances;


float unpack_depth(vec4 rgba_depth)
{
    const vec4 bit_shift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
    return dot(rgba_depth, bit_shift) * 2.0 - 1.0;
}

float shadowOcclusionL1(vec4 pos, float bias) {
    pos.xyz /= pos.w;
    pos.xyz = pos.xyz * 0.5 + 0.5;
    float fragDepth = min(pos.z, 0.999);
    vec2 uv = pos.xy;
    return step(unpack_depth(texture2D(u_shadowmap_1, uv)) + bias, fragDepth);
}

float shadowOcclusionL0(vec4 pos, float bias) {
    pos.xyz /= pos.w;
    pos.xyz = pos.xyz * 0.5 + 0.5;
    float fragDepth = min(pos.z, 0.999);
    vec2 uv = pos.xy;

    vec2 texel = uv / u_texel_size - vec2(1.5);
    vec2 f = fract(texel);

    float s = u_texel_size;

    // brute force sampling
    vec2 uv00 = (texel - f + 0.5) * u_texel_size;
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

    float o00 = step(unpack_depth(texture2D(u_shadowmap_0, uv00)) + bias, fragDepth);
    float o10 = step(unpack_depth(texture2D(u_shadowmap_0, uv10)) + bias, fragDepth);
    float o20 = step(unpack_depth(texture2D(u_shadowmap_0, uv20)) + bias, fragDepth);
    float o30 = step(unpack_depth(texture2D(u_shadowmap_0, uv30)) + bias, fragDepth);

    float o01 = step(unpack_depth(texture2D(u_shadowmap_0, uv01)) + bias, fragDepth);
    float o11 = step(unpack_depth(texture2D(u_shadowmap_0, uv11)) + bias, fragDepth);
    float o21 = step(unpack_depth(texture2D(u_shadowmap_0, uv21)) + bias, fragDepth);
    float o31 = step(unpack_depth(texture2D(u_shadowmap_0, uv31)) + bias, fragDepth);

    float o02 = step(unpack_depth(texture2D(u_shadowmap_0, uv02)) + bias, fragDepth);
    float o12 = step(unpack_depth(texture2D(u_shadowmap_0, uv12)) + bias, fragDepth);
    float o22 = step(unpack_depth(texture2D(u_shadowmap_0, uv22)) + bias, fragDepth);
    float o32 = step(unpack_depth(texture2D(u_shadowmap_0, uv32)) + bias, fragDepth);

    float o03 = step(unpack_depth(texture2D(u_shadowmap_0, uv03)) + bias, fragDepth);
    float o13 = step(unpack_depth(texture2D(u_shadowmap_0, uv13)) + bias, fragDepth);
    float o23 = step(unpack_depth(texture2D(u_shadowmap_0, uv23)) + bias, fragDepth);
    float o33 = step(unpack_depth(texture2D(u_shadowmap_0, uv33)) + bias, fragDepth);

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

#endif