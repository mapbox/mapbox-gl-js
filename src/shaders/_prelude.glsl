// IMPORTANT:
// This prelude is injected in both vertex and fragment shader be wary
// of precision qualifiers as vertex and fragment precision may differ

#define EPSILON 0.0000001
#define PI 3.141592653589793

#ifdef RENDER_CUTOFF
// Calculates cutoff and fade out based on the supplied params and depth value
float cutoff_opacity(vec4 cutoff_params, float depth) {
    float near = cutoff_params.x;
    float far = cutoff_params.y;
    float cutoffStart = cutoff_params.z;
    float cutoffEnd = cutoff_params.w;

    float linearDepth = (depth - near) / (far - near);
    return clamp((linearDepth - cutoffStart) / (cutoffEnd - cutoffStart), 0.0, 1.0);
}
#endif
