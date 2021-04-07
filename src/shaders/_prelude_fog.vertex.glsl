#ifdef FOG

uniform mat4 u_cam_matrix;
uniform mediump vec2 u_fog_range;
uniform mediump float u_fog_opacity;

vec3 fog_position(vec3 pos) {
    // The following function requires that u_cam_matrix be affine and result in
    // a vector with w = 1. Otherwise we must divide by w.
    return (u_cam_matrix * vec4(pos, 1)).xyz;
}

// Computes the fog opacity when fog strength = 1. Otherwise it's multiplied
// by a smoothstep to a power to decrease the amount of fog relative to haze.
//   - t: depth, rescaled to 0 at fogStart and 1 at fogEnd
// See: https://www.desmos.com/calculator/3taufutxid
// This function much match src/style/fog.js
float fog_opacity(float t) {
    const float decay = 6.0;
    float falloff = 1.0 - min(1.0, exp(-decay * t));

    // Cube without pow()
    falloff *= falloff * falloff;

    // Scale and clip to 1 at the far limit
    return u_fog_opacity * min(1.0, 1.00747 * falloff);
}

float fog_pos_depth(vec3 pos) {
    // Map [near, far] to [0, 1]
    return (length(pos) - u_fog_range.x) / (u_fog_range.y - u_fog_range.x);
}

// Accept either 2D or 3D positions
vec3 fog_position(vec2 pos) {
    return fog_position(vec3(pos, 0));
}

#endif
