#ifdef FOG

uniform vec2 u_fog_range;
uniform vec3 u_fog_color;
uniform vec3 u_haze_color_linear;
uniform float u_haze_energy;
uniform float u_fog_opacity;
uniform float u_fog_sky_blend;
uniform float u_fog_temporal_offset;
uniform float u_fog_exponent;

vec3 tonemap(vec3 color) {
    // Use an exponential smoothmin between y=x and y=1 for tone-mapping
    // See: https://www.desmos.com/calculator/h8odggcnd0
    const float k = 8.0;
    return max(vec3(0), log2(exp2(-k * color) + exp2(-k)) * (-1.0 / k));
}

// Assumes z up and camera_dir *normalized* (to avoid computing its length multiple
// times for different functions).
float fog_sky_blending(vec3 camera_dir) {
    float t = max(0.0, camera_dir.z / u_fog_sky_blend);
    // Factor of 3 chosen to roughly match smoothstep.
    // See: https://www.desmos.com/calculator/pub31lvshf
    return u_fog_opacity * exp(-3.0 * t * t);
}

// This function gives the fog opacity when strength is 1. Otherwise it's multiplied
// by a smoothstep to a power to decrease the amount of fog relative to haze.
// This function much match src/style/fog.js
// See: https://www.desmos.com/calculator/3taufutxid
float fog_opacity(float t) {
    const float decay = 6.0;
    float falloff = 1.0 - min(1.0, exp(-decay * t));

    // Cube without pow()
    falloff *= falloff * falloff;

    // Scale and clip to 1 at the far limit
    return u_fog_opacity * min(1.0, 1.00747 * falloff);
}

float fog_opacity (vec3 pos) {
    return fog_opacity((length(pos) - u_fog_range.x) / (u_fog_range.y - u_fog_range.x));
}

vec3 fog_apply(vec3 color, vec3 pos) {
    // Map [near, far] to [0, 1]
    float t = (length(pos) - u_fog_range.x) / (u_fog_range.y - u_fog_range.x);

    float haze_opac = fog_opacity(pos);
    float fog_opac = haze_opac * pow(smoothstep(0.0, 1.0, t), u_fog_exponent);

#ifdef HAZE
    vec3 haze = (haze_opac * u_haze_energy) * u_haze_color_linear;

    // The smoothstep fades in tonemapping slightly before the fog layer. This causes
    // the principle that fog should not have an effect outside the fog layer, but the
    // effect is hardly noticeable except on pure white glaciers..
    float tonemap_strength = u_fog_opacity * min(1.0, u_haze_energy) * smoothstep(-0.5, 0.25, t);
    color = srgb_to_linear(color);
    color = mix(color, tonemap(color + haze), tonemap_strength);
    color = linear_to_srgb(color);
#endif

    return mix(color, u_fog_color, fog_opac);
}

// Assumes z up
vec3 fog_apply_sky_gradient(vec3 camera_ray, vec3 sky_color) {
    return mix(sky_color, u_fog_color, fog_sky_blending(normalize(camera_ray)));
}

// Un-premultiply the alpha, then blend fog, then re-premultiply alpha. For
// use with colors using premultiplied alpha
vec4 fog_apply_premultiplied(vec4 color, vec3 pos) {
    float a = 1e-4 + color.a;
    return vec4(fog_apply(min(color.rgb / a, vec3(1)), pos) * a, color.a);
}

vec3 fog_dither(vec3 color) {
    return dither(color, gl_FragCoord.xy + u_fog_temporal_offset);
}

vec4 fog_dither(vec4 color) {
    return vec4(fog_dither(color.rgb), color.a);
}

#endif
