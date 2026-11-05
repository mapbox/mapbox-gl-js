// NOTE: Include explicitly in fragment shaders that use indicator cutout (applyCutout).

#ifdef INDICATOR_CUTOUT
uniform vec3 u_indicator_cutout_centers;
uniform vec4 u_indicator_cutout_params;
#endif

vec4 applyCutout(vec4 color, float height) {
#ifdef INDICATOR_CUTOUT
    float verticalFadeRange = u_indicator_cutout_centers.z * 0.25; // Fade relative to the height of the indicator
    // smoothstep() written out: GLSL leaves it undefined for equal or reversed edges, which a ground-level or
    // underground indicator produces. A zero range is a hard step that cuts only what is above the indicator.
    float fadeT = verticalFadeRange == 0.0 ? float(height > u_indicator_cutout_centers.z) : clamp((height - u_indicator_cutout_centers.z) / verticalFadeRange, 0.0, 1.0);
    float holeMinOpacity = mix(1.0, u_indicator_cutout_params.x, fadeT * fadeT * (3.0 - 2.0 * fadeT));
    float holeRadius = max(u_indicator_cutout_params.y, 0.0);
    float holeAspectRatio = u_indicator_cutout_params.z;
    float fadeStart = u_indicator_cutout_params.w;
    float distA = distance(vec2(gl_FragCoord.x, gl_FragCoord.y * holeAspectRatio), vec2(u_indicator_cutout_centers[0], u_indicator_cutout_centers[1] * holeAspectRatio));
    return color * min(smoothstep(fadeStart, holeRadius, distA) + holeMinOpacity, 1.0);
#else
    return color;
#endif
}
