// IMPORTANT:
// This prelude is injected in both vertex and fragment shader be wary
// of precision qualifiers as vertex and fragment precision may differ

#ifdef LIGHTING_3D_MODE

// All color values are expected to be in linear color space
uniform mediump vec3 u_lighting_ambient_color;
uniform mediump vec3 u_lighting_directional_dir;        // Direction towards the light source
uniform mediump vec3 u_lighting_directional_color;
uniform mediump vec3 u_ground_radiance;

float calculate_ambient_directional_factor(vec3 normal) {
    // NdotL Used only for ambient directionality
    float NdotL = dot(normal, u_lighting_directional_dir);

    // Emulate sky being brighter close to the main light source

    const float factor_reduction_max = 0.3;
    float dir_luminance = dot(u_lighting_directional_color, vec3(0.2126, 0.7152, 0.0722));
    float directional_factor_min = 1.0 - factor_reduction_max * min(dir_luminance, 1.0);
    
    // If u_lighting_directional_color is (1, 1, 1), then the return value range is
    // NdotL=-1: 1.0 - factor_reduction_max
    // NdotL>=0: 1.0
    float ambient_directional_factor = mix(directional_factor_min, 1.0, min((NdotL + 1.0), 1.0));

    // Emulate environmental light being blocked by other objects

    // Value moves from vertical_factor_min at z=-1 to 1.0 at z=1
    const float vertical_factor_min = 0.92;
    float vertical_factor = mix(vertical_factor_min, 1.0, normal.z * 0.5 + 0.5);
    return vertical_factor * ambient_directional_factor;
}

// BEGIN Used for anisotropic ambient light

// BEGIN Use with shadows, pass shadow light factor as dir_factor

vec3 apply_lighting(vec3 color, vec3 normal, float dir_factor) {
    // TODO: Use a cubemap to sample precalculated values
    float ambient_directional_factor = calculate_ambient_directional_factor(normal);
    vec3 ambient_contrib = ambient_directional_factor * u_lighting_ambient_color;
    vec3 directional_contrib = u_lighting_directional_color * dir_factor;
    return linearProduct(color, ambient_contrib + directional_contrib);
}

vec4 apply_lighting(vec4 color, vec3 normal, float dir_factor) {
    return vec4(apply_lighting(color.rgb, normal, dir_factor), color.a);
}

// END Use with shadows

vec3 apply_lighting(vec3 color, vec3 normal) {
    float dir_factor = max(dot(normal, u_lighting_directional_dir), 0.0);
    return apply_lighting(color.rgb, normal, dir_factor);
}

vec4 apply_lighting(vec4 color, vec3 normal) {
    float dir_factor = max(dot(normal, u_lighting_directional_dir), 0.0);
    return vec4(apply_lighting(color.rgb, normal, dir_factor), color.a);
}

vec3 apply_lighting_ground(vec3 color) {
    return color * u_ground_radiance;
}

vec4 apply_lighting_ground(vec4 color) {
    return vec4(apply_lighting_ground(color.rgb), color.a);
}

// END Used for anisotropic ambient light

float calculate_NdotL(vec3 normal) {
    // Use slightly modified dot product for lambertian diffuse shading. This increase the range of NdotL to cover surfaces facing up to 45 degrees away from the light source.
    // This allows us to trade some realism for performance/usability as a single light source is enough to shade the scene.
    const float ext = 0.70710678118; // acos(pi/4)
    return (clamp(dot(normal, u_lighting_directional_dir), -ext, 1.0) + ext) / (1.0 + ext);
}

vec4 apply_lighting_with_emission_ground(vec4 color, float emissive_strength) {
    return mix(apply_lighting_ground(color), color, emissive_strength);
}

vec3 compute_flood_lighting(vec3 flood_light_color, float fully_occluded_factor, float occlusion, vec3 ground_shadow_factor) {
    // Compute final color by interpolating between the fully occluded
    // and fully lit colors. Use a more steep ramp to avoid shadow acne on low angles.
    vec3 fully_occluded_color = flood_light_color * mix(ground_shadow_factor, vec3(1.0), fully_occluded_factor);
    float occlusion_ramp = smoothstep(0.0, 0.2, 1.0 - occlusion);
    return mix(fully_occluded_color, flood_light_color, occlusion_ramp);
}

vec3 compute_emissive_draped(vec3 unlit_color, float fully_occluded_factor, float occlusion, vec3 ground_shadow_factor) {
    vec3 fully_occluded_color = unlit_color * mix(ground_shadow_factor, vec3(1.0), fully_occluded_factor);
    return mix(fully_occluded_color, unlit_color, 1.0 - occlusion);
}

#endif // LIGHTING_3D_MODE
