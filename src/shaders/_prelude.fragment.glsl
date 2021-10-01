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

#ifdef TERRAIN

// Pack depth to RGBA. A piece of code copied in various libraries and WebGL
// shadow mapping examples.
highp vec4 pack_depth(highp float ndc_z) {
    highp float depth = ndc_z * 0.5 + 0.5;
    const highp vec4 bit_shift = vec4(256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0);
    const highp vec4 bit_mask  = vec4(0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);
    highp vec4 res = fract(depth * bit_shift);
    res -= res.xxyz * bit_mask;
    return res;
}

#endif

#ifdef FOG

float gridFactor (float parameter, float width, float feather) {
  float w1 = width - feather * 0.5;
  float d = fwidth(parameter);
  float looped = (0.5 - abs(mod(parameter, 1.0) - 0.5)) / u_pixel_ratio;
  return smoothstep(d * (w1 + feather), d * w1, looped);
}

float fog_opacity(float t) {
    return
        1.0 * gridFactor(t, 2.0, 1.0) +
        0.7 * gridFactor(10.0 * t, 0.5, 1.0);
}

#endif
