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

#ifdef FOG

float fog_range(vec2 range, float depth) {
    // Map [near, far] to [0, 1] without clamping
    return (depth - range[0]) / (range[1] - range[0]);
}

// Assumes z up and camera_dir *normalized* (to avoid computing
// its length multiple times for different functions).
float fog_horizon_blending(vec4 color, float blend, vec3 camera_dir) {
    float t = max(0.0, camera_dir.z / blend);
    // Factor of 3 chosen to roughly match smoothstep.
    // See: https://www.desmos.com/calculator/pub31lvshf
    return color.a * exp(-3.0 * t * t);
}

// Compute a ramp for fog opacity
//   - t: depth, rescaled to 0 at fogStart and 1 at fogEnd
// See: https://www.desmos.com/calculator/3taufutxid
float fog_opacity(vec4 color, float t) {
    const float decay = 6.0;
    float falloff = 1.0 - min(1.0, exp(-decay * t));

    // Cube without pow() to smooth the onset
    falloff *= falloff * falloff;

    // Scale and clip to 1 at the far limit
    return color.a * min(1.0, 1.00747 * falloff);
}

#endif
