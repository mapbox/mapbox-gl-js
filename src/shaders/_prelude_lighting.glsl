#ifdef LIGHTING_3D_MODE

uniform mediump vec3 u_lighting_ambient_color;
uniform mediump vec3 u_lighting_directional_dir;        // Direction towards the light source
uniform mediump vec3 u_lighting_directional_color;

vec3 srgb_to_lin(vec3 srgb)
{
    return mix(
        pow((srgb + vec3(0.055)) / 1.055, vec3(2.4)),
        srgb / vec3(12.92),
        step(srgb, vec3(0.04045))
    );
}

vec3 lin_to_srgb(vec3 lin)
{
    return mix(
        pow(lin, vec3(1.0 / 2.4)) * 1.055 - vec3(0.055),
        lin * vec3(12.92),
        step(lin, vec3(0.0031308))
    );
}

vec3 apply_lighting(vec3 color) {
    float NdotL = u_lighting_directional_dir.z;
    return lin_to_srgb(srgb_to_lin(color) * (srgb_to_lin(u_lighting_ambient_color) + srgb_to_lin(u_lighting_directional_color) * NdotL));
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
    return lin_to_srgb(srgb_to_lin(color) * (srgb_to_lin(u_lighting_ambient_color) + srgb_to_lin(u_lighting_directional_color) * NdotL));
}

vec4 apply_lighting(vec4 color, float NdotL) {
    return vec4(apply_lighting(color.rgb, NdotL), color.a);
}

#endif
