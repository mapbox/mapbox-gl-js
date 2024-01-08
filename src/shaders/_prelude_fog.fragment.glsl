highp vec3 hash(highp vec2 p) {
    highp vec3 p3 = fract(p.xyx * vec3(443.8975, 397.2973, 491.1871));
    p3 += dot(p3, p3.yxz + 19.19);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
}

vec3 dither(vec3 color, highp vec2 seed) {
    vec3 rnd = hash(seed) + hash(seed + 0.59374) - 0.5;
    return color + rnd / 255.0;
}

#ifdef FOG

uniform mediump vec4 u_fog_color;
uniform mediump vec2 u_fog_range;
uniform mediump float u_fog_horizon_blend;
uniform mediump vec2 u_fog_vertical_limit;
uniform mediump float u_fog_temporal_offset;
in vec3 v_fog_pos;

uniform highp vec3 u_frustum_tl;
uniform highp vec3 u_frustum_tr;
uniform highp vec3 u_frustum_br;
uniform highp vec3 u_frustum_bl;
uniform highp vec3 u_globe_pos;
uniform highp float u_globe_radius;
uniform highp vec2 u_viewport;
uniform float u_globe_transition;
uniform int u_is_globe;

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

float globe_glow_progress() {
    highp vec2 uv = gl_FragCoord.xy / u_viewport;
    highp vec3 ray_dir = mix(
        mix(u_frustum_tl, u_frustum_tr, uv.x),
        mix(u_frustum_bl, u_frustum_br, uv.x),
        1.0 - uv.y);
    highp vec3 dir = normalize(ray_dir);
    highp vec3 closest_point = dot(u_globe_pos, dir) * dir;
    highp float sdf = length(closest_point - u_globe_pos) / u_globe_radius;
    return sdf + PI * 0.5;
}

// This function is only used in rare places like heatmap where opacity is used
// directly, outside the normal fog_apply method.
float fog_opacity(vec3 pos) {
    float depth = length(pos);
    return fog_opacity(fog_range(depth));
}

vec3 fog_apply(vec3 color, vec3 pos, float opacity_limit) {
    float depth = length(pos);
    float opacity;
    if (u_is_globe == 1) {
        float glow_progress = globe_glow_progress();
        float t = mix(glow_progress, depth, u_globe_transition);
        opacity = fog_opacity(fog_range(t));
    } else {
        opacity = fog_opacity(fog_range(depth));
        opacity *= fog_horizon_blending(pos / depth);
    }
    return mix(color, u_fog_color.rgb, min(opacity, opacity_limit));
}

vec3 fog_apply(vec3 color, vec3 pos) {
    return fog_apply(color, pos, 1.0);
}

// Apply fog computed in the vertex shader
vec4 fog_apply_from_vert(vec4 color, float fog_opac) {
    float alpha = EPSILON + color.a;
    color.rgb = mix(color.rgb / alpha, u_fog_color.rgb, fog_opac) * alpha;
    return color;
}

// Assumes z up
vec3 fog_apply_sky_gradient(vec3 camera_ray, vec3 sky_color) {
    float horizon_blend = fog_horizon_blending(normalize(camera_ray));
    return mix(sky_color, u_fog_color.rgb, horizon_blend);
}

// Un-premultiply the alpha, then blend fog, then re-premultiply alpha.
// For use with colors using premultiplied alpha
vec4 fog_apply_premultiplied(vec4 color, vec3 pos) {
    float alpha = EPSILON + color.a;
    color.rgb = fog_apply(color.rgb / alpha, pos) * alpha;
    return color;
}

vec4 fog_apply_premultiplied(vec4 color, vec3 pos, float heightMeters) {
    float verticalProgress = (u_fog_vertical_limit.x > 0.0 || u_fog_vertical_limit.y > 0.0) ? smoothstep(u_fog_vertical_limit.x, u_fog_vertical_limit.y, heightMeters) : 0.0;
    // If the fog's opacity is above 90% the content needs to be faded out without the vertical visibility
    // to avoid a hard cut when the content gets behind the cull distance
    float opacityLimit = 1.0 - smoothstep(0.9, 1.0, fog_opacity(pos));
    return mix(fog_apply_premultiplied(color, pos), color, min(verticalProgress, opacityLimit));
}

vec3 fog_dither(vec3 color) {
#ifdef FOG_DITHERING
    vec2 dither_seed = gl_FragCoord.xy + u_fog_temporal_offset;
    return dither(color, dither_seed);
#else
    return color;
#endif
}

vec4 fog_dither(vec4 color) {
    return vec4(fog_dither(color.rgb), color.a);
}

#endif
