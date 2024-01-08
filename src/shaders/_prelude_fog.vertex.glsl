#ifdef FOG

uniform mediump vec4 u_fog_color;
uniform mediump vec2 u_fog_range;
uniform mediump float u_fog_horizon_blend;
uniform mediump mat4 u_fog_matrix;
out vec3 v_fog_pos;

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

// Compute a ramp for fog opacity
//   - t: depth, rescaled to 0 at fogStart and 1 at fogEnd
// See: https://www.desmos.com/calculator/3taufutxid
float fog_opacity(float t) {
    const float decay = 6.0;
    float falloff = 1.0 - min(1.0, exp(-decay * t));

    // Cube without pow() to smooth the onset
    falloff *= falloff * falloff;

    // Scale and clip to 1 at the far limit
    return u_fog_color.a * min(1.0, 1.00747 * falloff);
}

vec3 fog_position(vec3 pos) {
    // The following function requires that u_fog_matrix be affine and
    // results in a vector with w = 1. Otherwise we must divide by w.
    return (u_fog_matrix * vec4(pos, 1.0)).xyz;
}

vec3 fog_position(vec2 pos) {
    return fog_position(vec3(pos, 0.0));
}

float fog(vec3 pos) {
    float depth = length(pos);
    float opacity = fog_opacity(fog_range(depth));
    return opacity * fog_horizon_blending(pos / depth);
}

#endif
