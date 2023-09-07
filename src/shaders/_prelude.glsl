// IMPORTANT:
// This prelude is injected in both vertex and fragment shader be wary
// of precision qualifiers as vertex and fragment precision may differ

#define EPSILON 0.0000001
#define PI 3.141592653589793
#define EXTENT 8192.0
#define HALF_PI PI / 2.0
#define QUARTER_PI PI / 4.0
#define RAD_TO_DEG 180.0 / PI
#define DEG_TO_RAD PI / 180.0
#define GLOBE_RADIUS EXTENT / PI / 2.0

// linear to sRGB approximation
vec3 linearTosRGB(vec3 color)
{
    return pow(color, vec3(1./2.2));
}

// sRGB to linear approximation
vec3 sRGBToLinear(vec3 srgbIn)
{
    return pow(srgbIn, vec3(2.2));
}

// equivalent to linearTosRGB(sRGBToLinear(srgbIn) * k)
vec3 linearProduct(vec3 srgbIn, vec3 k)
{
    return srgbIn * pow(k, vec3(1./2.2));
}

// Apply depth for wireframe overlay to reduce z-fighting
#if __VERSION__ >= 300
    #define _HANDLE_WIREFRAME_DEPTH gl_FragDepth = gl_FragCoord.z - 0.0001;
#else
    #define _HANDLE_WIREFRAME_DEPTH
#endif

#ifdef DEBUG_WIREFRAME
    // Debug wireframe uses premultiplied alpha blending (alpha channel is left unchanged)
    #define HANDLE_WIREFRAME_DEBUG \
        gl_FragColor = vec4(0.7, 0.0, 0.0, 0.7); \
        _HANDLE_WIREFRAME_DEPTH;
#else
    #define HANDLE_WIREFRAME_DEBUG
#endif

#ifdef RENDER_CUTOFF
// Calculates cutoff and fade out based on the supplied params and depth value
float cutoff_opacity(vec4 cutoff_params, float depth) {
    float near = cutoff_params.x;
    float far = cutoff_params.y;
    float cutoffStart = cutoff_params.z;
    // 0.0001 subtracted to prevent division by zero
    float cutoffEnd = cutoff_params.w - 0.0001;

    float linearDepth = (depth - near) / (far - near);
    return clamp((linearDepth - cutoffStart) / (cutoffEnd - cutoffStart), 0.0, 1.0);
}
#endif