#ifdef LIGHTING_3D_MODE

uniform mediump vec3 u_lighting_ambient_color;
uniform mediump vec3 u_lighting_directional_dir;        // Direction towards the light source
uniform mediump vec3 u_lighting_directional_color;

vec3 apply_lighting(vec3 color) {
    float NdotL = u_lighting_directional_dir.z;
    return color * (u_lighting_ambient_color + u_lighting_directional_color * NdotL);
}

vec4 apply_lighting(vec4 color) {
    return vec4(apply_lighting(color.rgb), color.a);
}

float calculate_NdotL(vec3 normal) {
    // Use slightly modified dot product for lambertian diffuse shading. This increase the range of NdotL to cover surfaces facing up to 45 degrees away from the light source.
    // This allows us to trade some realism for performance/usability as a single light source is enough to shade the scene.
    const float ext = 0.70710678118; // acos(pi/4)
    return (clamp(dot(normal, u_lighting_directional_dir), -ext, 1.0) + ext) / (1.0 + ext);
}

vec3 apply_lighting(vec3 color, float NdotL) {
    return color * (u_lighting_ambient_color + u_lighting_directional_color * NdotL);
}

vec4 apply_lighting(vec4 color, float NdotL) {
    return vec4(apply_lighting(color.rgb, NdotL), color.a);
}

#endif
