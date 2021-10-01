// IMPORTANT:
// This prelude is injected in both vertex and fragment shader be wary
// of precision qualifiers as vertex and fragment precision may differ

#define EPSILON 0.0000001
#define PI 3.141592653589793
#define EXTENT 8192.0

#ifdef FOG

uniform mediump vec4 u_fog_color;
uniform mediump vec2 u_fog_range;
uniform mediump float u_fog_horizon_blend;
uniform mediump float u_pixel_ratio;

varying vec3 v_fog_pos;

float fog_range(float depth) {
    // Map [near, far] to [0, 1] without clamping
    return (depth - u_fog_range[0]) / (u_fog_range[1] - u_fog_range[0]);
}

// Assumes z up and camera_dir *normalized* (to avoid computing
// its length multiple times for different functions).
float fog_horizon_blending(vec3 camera_dir) {
    float t = max(0.0, camera_dir.z / u_fog_horizon_blend);
    // Factor of 3 chosen to roughly match smoothstep.
    // See: https://www.desmos.com/calculator/pub31lvshf
    return u_fog_color.a * exp(-3.0 * t * t);
}

#endif
