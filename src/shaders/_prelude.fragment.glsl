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

const float PI = 3.141592653589793;

#define GAMMA_CORRECT

vec3 linearToSRGB(vec3 color) {
// TODO: Make a choice and remove this conditional before production
#ifdef GAMMA_CORRECT
    vec3 a = 12.92 * color;
    vec3 b = 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055;
    vec3 c = step(vec3(0.0031308), color);
    return mix(a, b, c);
#else
    return color;
#endif
}

vec3 srgbToLinear(vec3 color) {
// TODO: Make a choice and remove this conditional before production
#ifdef GAMMA_CORRECT
    vec3 a = color / 12.92;
    vec3 b = pow((color + 0.055) / 1.055, vec3(2.4));
    vec3 c = step(vec3(0.04045), color);
    return mix(a, b, c);
#else
    return color;
#endif
}

vec3 gammaMix(vec3 a, vec3 b, float x) {
    return linearToSRGB(mix(srgbToLinear(a), srgbToLinear(b), x));
}
