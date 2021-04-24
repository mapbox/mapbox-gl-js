// IMPORTANT:
// This prelude is injected in both vertex and fragment shader be wary
// of precision qualifiers as vertex and fragment precision may differ

#ifdef FOG

uniform mediump float u_fog_opacity;
uniform mediump vec2 u_fog_range;
uniform mediump float u_fog_horizon_blend;

float fog_range(float depth) {
    // Map [near, far] to [0, 1] without clamping
    return (depth - u_fog_range[0]) / (u_fog_range[1] - u_fog_range[0]);
}

// Assumes z up and camera_dir *normalized* (to avoid computing its length multiple
// times for different functions).
// Must match definitions in:
// src/shaders/_prelude_fog.vertex.glsl#fog_horizon_blending
// src/style/fog_helpers.js#getFogSkyBlending
float fog_horizon_blending(vec3 camera_dir) {
    float t = max(0.0, camera_dir.z / u_fog_horizon_blend);
    // Factor of 3 chosen to roughly match smoothstep.
    // See: https://www.desmos.com/calculator/pub31lvshf
    return u_fog_opacity * exp(-3.0 * t * t);
}

// Compute a ramp for fog opacity
//   - t: depth, rescaled to 0 at fogStart and 1 at fogEnd
// See: https://www.desmos.com/calculator/3taufutxid
// This function much match src/style/fog.js and _prelude_fog.vertex.glsl
float fog_opacity(float t) {
    const float decay = 6.0;
    float falloff = 1.0 - min(1.0, exp(-decay * t));

    // Cube without pow() to smooth the onset
    falloff *= falloff * falloff;

    // Scale and clip to 1 at the far limit
    return u_fog_opacity * min(1.0, 1.00747 * falloff);
}

#endif

#ifdef HAZE

uniform mediump vec2 u_haze_range;

// Compute a ramp for fog opacity
//   - t: depth, rescaled to 0 at fogStart and 1 at fogEnd
// See: https://www.desmos.com/calculator/3taufutxid
// This function much match src/style/fog.js and _prelude_fog.vertex.glsl
float haze_opacity(float t) {
    const float decay = 6.0;
    float falloff = 1.0 - min(1.0, exp(-decay * t));

    // Cube without pow() to smooth the onset
    falloff *= falloff * falloff;

    // Scale and clip to 1 at the far limit
    return min(1.0, 1.00747 * falloff);
}


float haze_range(float depth) {
    // Map [near, far] to [0, 1] without clamping
    return (depth - u_haze_range[0]) / (u_haze_range[1] - u_haze_range[0]);
}
#endif
