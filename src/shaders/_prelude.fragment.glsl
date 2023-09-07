// NOTE: This prelude is injected in the fragment shader only

#if __VERSION__ >= 300
#define varying in
#define gl_FragColor glFragColor
#define texture2D texture
#define textureCube texture
out vec4 glFragColor;
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

#ifdef INDICATOR_CUTOUT
uniform vec2 u_indicator_cutout_centers;
uniform vec4 u_indicator_cutout_params;
#endif

// TODO: could be moved to a separate prelude
vec4 applyCutout(vec4 color) {
#ifdef INDICATOR_CUTOUT
    float holeMinOpacity = u_indicator_cutout_params.x;
    float holeRadius = max(u_indicator_cutout_params.y, 0.0);
    float holeAspectRatio = u_indicator_cutout_params.z;
    float fadeStart = u_indicator_cutout_params.w;
    float distA = distance(vec2(gl_FragCoord.x, gl_FragCoord.y * holeAspectRatio), vec2(u_indicator_cutout_centers[0], u_indicator_cutout_centers[1] * holeAspectRatio));
    return color * min(smoothstep(fadeStart, holeRadius, distA) + holeMinOpacity, 1.0);
#else
    return color;
#endif
}

#ifdef RENDER_CUTOFF
uniform highp vec4 u_cutoff_params;
varying float v_cutoff_opacity;
#endif