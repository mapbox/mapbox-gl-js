#ifdef GL_ES
precision mediump float;
#else

#if !defined(lowp)
#define lowp
#endif

#if !defined(mediump)
#define mediump
#endif

#if !defined(highp)
#define highp
#endif

#endif

highp vec3 hash(highp vec2 p) {
    highp vec3 p3 = fract(p.xyx * vec3(443.8975, 397.2973, 491.1871));
    p3 += dot(p3, p3.yxz + 19.19);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
}

vec3 dither(vec3 color, highp vec2 seed) {
    vec3 rnd = hash(seed) + hash(seed + 0.59374) - 0.5;
    return color + rnd / 255.0;
}
