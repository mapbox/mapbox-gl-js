// IMPORTANT:
// This prelude is injected in both vertex and fragment shader be wary
// of precision qualifiers as vertex and fragment precision may differ

#ifdef LIGHTING_3D_MODE

// All color values are expected to be in linear color space
uniform mediump vec3 u_lighting_ambient_color;
uniform mediump vec3 u_lighting_directional_dir;        // Direction towards the light source
uniform mediump vec3 u_lighting_directional_color;

// Applies 3D lighting and returns the result in sRGB color space.
vec3 apply_lighting(vec3 color) {
    float NdotL = u_lighting_directional_dir.z;
    vec3 litColor = sRGBToLinear(color) * (u_lighting_ambient_color + u_lighting_directional_color * NdotL);
    return linearTosRGB(clamp(litColor, 0.0, 1.0));
}

vec4 apply_lighting(vec4 color) {
    return vec4(apply_lighting(color.rgb), color.a);
}

vec3 apply_lighting(vec3 color, float NdotL) {
    return linearTosRGB(sRGBToLinear(color) * (u_lighting_ambient_color + u_lighting_directional_color * NdotL));
}

vec4 apply_lighting(vec4 color, float NdotL) {
    return vec4(apply_lighting(color.rgb, NdotL), color.a);
}

float calculate_NdotL(vec3 normal) {
    // Use slightly modified dot product for lambertian diffuse shading. This increase the range of NdotL to cover surfaces facing up to 45 degrees away from the light source.
    // This allows us to trade some realism for performance/usability as a single light source is enough to shade the scene.
    const float ext = 0.70710678118; // acos(pi/4)
    return (clamp(dot(normal, u_lighting_directional_dir), -ext, 1.0) + ext) / (1.0 + ext);
}

vec4 apply_lighting_with_emission(vec4 color, float emissive_strength) {
    return mix(apply_lighting(color), color, emissive_strength);
}

#endif
