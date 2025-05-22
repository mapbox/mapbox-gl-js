#include "_prelude_fog.fragment.glsl"
#include "_prelude_lighting.glsl"
#include "_prelude_shadow.fragment.glsl"

in vec3 v_normal;
in float v_height;

#ifdef RENDER_SHADOWS
in highp vec4 v_pos_light_view_0;
in highp vec4 v_pos_light_view_1;
in float v_depth;
#endif

// linear to sRGB approximation
vec3 linearTosRGB(vec3 color) {
    return pow(color, vec3(1./2.2));
}
vec3 sRGBToLinear(vec3 srgbIn) {
    return pow(srgbIn, vec3(2.2));
}

vec3 compute_view_dependent_emissive_color(float ndotl, float emissive_strength, vec3 color)
{
    color = sRGBToLinear(color);
    color = color * (ndotl + (1.0 - min(ndotl * 57.29, 1.0)) * emissive_strength);
    color = linearTosRGB(color.rgb);
    return color;
}

uniform float u_emissive_strength;

#pragma mapbox: define highp vec4 structure_color

void main() {
    #pragma mapbox: initialize highp vec4 structure_color
    vec3 color = structure_color.xyz;
#ifdef LIGHTING_3D_MODE
    vec3 normal = normalize(v_normal);
    vec3 transformed_normal = vec3(-normal.xy, normal.z);
    float ndotl = calculate_NdotL(transformed_normal);

    float emissive_strength = u_emissive_strength;
    // todo, we will wait on the designer for deciding which property to be used for the emissive_strength;
    emissive_strength = 0.0;
    vec3 emissive_color = compute_view_dependent_emissive_color(ndotl, emissive_strength, color.xyz);
#ifdef RENDER_SHADOWS
    float shadowed_lighting_factor = shadowed_light_factor_normal(transformed_normal, v_pos_light_view_0, v_pos_light_view_1, v_depth);
    color.rgb = apply_lighting(color.rgb, transformed_normal, shadowed_lighting_factor);
#else // RENDER_SHADOWS
    color = apply_lighting(color, transformed_normal);
#endif // RENDER_SHADOWS
    color = mix(color, emissive_color, emissive_strength);

    if (v_height < 0.0) {
        // HACK: compute temporary non-linear underground occlusion down to -7.5 meters
        float penetration = max(v_height + 7.5, 0.0);
        float occlusion = 1.0 - 1.0 / PI * acos(1.0 - penetration / 4.0);

        color = color * (1.0 - pow(occlusion, 2.0) * 0.3);
    }
#endif // LIGHTING_3D_MODE
#ifdef FOG
    color = fog_apply(color, v_fog_pos);
#endif
    vec4 out_color = vec4(color, 1.0);
#ifdef INDICATOR_CUTOUT
    out_color = applyCutout(out_color, v_height);
#endif
    glFragColor = out_color;

    HANDLE_WIREFRAME_DEBUG;
}
