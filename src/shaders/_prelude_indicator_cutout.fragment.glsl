// NOTE: Include explicitly in fragment shaders that use indicator cutout (applyCutout).

#ifdef INDICATOR_CUTOUT
uniform vec3 u_indicator_cutout_centers;
uniform vec4 u_indicator_cutout_params;
#endif

vec4 applyCutout(vec4 color, float height) {
#ifdef INDICATOR_CUTOUT
    float verticalFadeRange = u_indicator_cutout_centers.z * 0.25; // Fade relative to the height of the indicator
    float holeMinOpacity = mix(1.0, u_indicator_cutout_params.x, smoothstep(u_indicator_cutout_centers.z, u_indicator_cutout_centers.z + verticalFadeRange, height));
    float holeRadius = max(u_indicator_cutout_params.y, 0.0);
    float holeAspectRatio = u_indicator_cutout_params.z;
    float fadeStart = u_indicator_cutout_params.w;
    float distA = distance(vec2(gl_FragCoord.x, gl_FragCoord.y * holeAspectRatio), vec2(u_indicator_cutout_centers[0], u_indicator_cutout_centers[1] * holeAspectRatio));
    return color * min(smoothstep(fadeStart, holeRadius, distA) + holeMinOpacity, 1.0);
#else
    return color;
#endif
}
