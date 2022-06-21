// NOTE: This prelude is injected in the fragment shader only

highp vec3 hash(highp vec2 p) {
    highp vec3 p3 = fract(p.xyx * vec3(443.8975, 397.2973, 491.1871));
    p3 += dot(p3, p3.yxz + 19.19);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
}

vec3 dither(vec3 color, highp vec2 seed) {
    vec3 rnd = hash(seed) + hash(seed + 0.59374) - 0.5;
    return color + rnd / 255.0;
}

highp float unpack_depth(highp vec4 rgba_depth)
{
    const highp vec4 bit_shift = vec4(1.0 / (255.0 * 255.0 * 255.0), 1.0 / (255.0 * 255.0), 1.0 / 255.0, 1.0);
    return dot(rgba_depth, bit_shift) * 2.0 - 1.0;
}

// Pack depth to RGBA. A piece of code copied in various libraries and WebGL
// shadow mapping examples.
// https://aras-p.info/blog/2009/07/30/encoding-floats-to-rgba-the-final/
highp vec4 pack_depth(highp float ndc_z) {
    highp float depth = ndc_z * 0.5 + 0.5;
    const highp vec4 bit_shift = vec4(255.0 * 255.0 * 255.0, 255.0 * 255.0, 255.0, 1.0);
    const highp vec4 bit_mask  = vec4(0.0, 1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0);
    highp vec4 res = fract(depth * bit_shift);
    res -= res.xxyz * bit_mask;
    return res;
}
