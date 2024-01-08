#include "_prelude_fog.fragment.glsl"
#include "_prelude_shadow.fragment.glsl"
#include "_prelude_lighting.glsl"

in vec4 v_color;
in vec4 v_flat;

#ifdef RENDER_SHADOWS
in highp vec4 v_pos_light_view_0;
in highp vec4 v_pos_light_view_1;
in float v_depth;
#endif

uniform lowp float u_opacity;

#ifdef FAUX_AO
uniform lowp vec2 u_ao;
in vec2 v_ao;
#endif

#if defined(ZERO_ROOF_RADIUS) && !defined(LIGHTING_3D_MODE)
in vec4 v_roof_color;
#endif

#if defined(ZERO_ROOF_RADIUS) || defined(RENDER_SHADOWS) || defined(LIGHTING_3D_MODE)
in highp vec3 v_normal;
#endif

uniform vec3 u_flood_light_color;
uniform highp float u_vertical_scale;
uniform float u_flood_light_intensity;
uniform vec3 u_ground_shadow_factor;

#if defined(LIGHTING_3D_MODE) && defined(FLOOD_LIGHT)
in float v_flood_radius;
in float v_has_floodlight;
#endif

uniform float u_emissive_strength;

in float v_height;

void main() {

#if defined(ZERO_ROOF_RADIUS) || defined(RENDER_SHADOWS) || defined(LIGHTING_3D_MODE)
    vec3 normal = normalize(v_normal);
#endif

float z;
vec4 color = v_color;
#ifdef ZERO_ROOF_RADIUS
    z = float(normal.z > 0.00001);
#ifdef LIGHTING_3D_MODE
    normal = mix(normal, vec3(0.0, 0.0, 1.0), z);
#else // LIGHTING_3D_MODE
    color = mix(v_color, v_roof_color, z);
#endif // !LIGHTING_3D_MODE
#endif // ZERO_ROOF_RADIUS

float h = max(0.0, v_height);
float ao_shade = 1.0;
#ifdef FAUX_AO
    float intensity = u_ao[0];
    float h_floors = h / (u_ao[1] * u_vertical_scale);
    float y_shade = 1.0 - 0.9 * intensity * min(v_ao.y, 1.0);
    ao_shade = (1.0 - 0.08 * intensity) * (y_shade + (1.0 - y_shade) * (1.0 - pow(1.0 - min(h_floors / 16.0, 1.0), 16.0))) + 0.08 * intensity * min(h_floors / 160.0, 1.0);
    // concave angle
    float concave = v_ao.x * v_ao.x;
#ifdef ZERO_ROOF_RADIUS
    concave *= (1.0 - z);
#endif
    float x_shade = mix(1.0, mix(0.6, 0.75, min(h_floors / 30.0, 1.0)), intensity) + 0.1 * intensity * min(h, 1.0);
    ao_shade *= mix(1.0, x_shade * x_shade * x_shade, concave);

#ifdef LIGHTING_3D_MODE
#ifdef FLOOD_LIGHT
    color.rgb *= mix(ao_shade, 1.0, v_has_floodlight); // flood light and AO are mutually exclusive effects.
#else // FLOOD_LIGHT
    color.rgb *= ao_shade;
#endif // !FLOOD_LIGHT
#else // LIGHTING_3D_MODE
    color.rgb *= ao_shade;
#endif // !LIGHTING_3D_MODE

#endif // FAUX_AO

#ifdef LIGHTING_3D_MODE

float flood_radiance = 0.0;
#ifdef FLOOD_LIGHT
    flood_radiance = (1.0 - min(h / v_flood_radius, 1.0)) * u_flood_light_intensity * v_has_floodlight;
#endif // FLOOD_LIGHT
#ifdef RENDER_SHADOWS
#ifdef FLOOD_LIGHT
    float ndotl_unclamped = dot(normal, u_shadow_direction);
    float ndotl = max(0.0, ndotl_unclamped);
    float occlusion = ndotl_unclamped < 0.0 ? 1.0 : shadow_occlusion(ndotl, v_pos_light_view_0, v_pos_light_view_1, v_depth);

    // Compute both FE and flood lights separately and interpolate between the two.
    // "litColor" uses pretty much "shadowed_light_factor_normal" as the directional component.
    vec3 litColor = apply_lighting(color.rgb, normal, (1.0 - u_shadow_intensity * occlusion) * ndotl);
    vec3 floodLitColor = compute_flood_lighting(u_flood_light_color * u_opacity, 1.0 - u_shadow_intensity, occlusion, u_ground_shadow_factor);

    color.rgb = mix(litColor, floodLitColor, flood_radiance);
#else // FLOOD_LIGHT
    float shadowed_lighting_factor = shadowed_light_factor_normal(normal, v_pos_light_view_0, v_pos_light_view_1, v_depth);
    color.rgb = apply_lighting(color.rgb, normal, shadowed_lighting_factor);
#endif // !FLOOD_LIGHT 
#else // RENDER_SHADOWS
    color.rgb = apply_lighting(color.rgb, normal);
#ifdef FLOOD_LIGHT
    color.rgb = mix(color.rgb, u_flood_light_color * u_opacity, flood_radiance);
#endif // FLOOD_LIGHT
#endif // !RENDER_SHADOWS

    color.rgb = mix(color.rgb, v_flat.rgb, u_emissive_strength);
    color *= u_opacity;
#endif // LIGHTING_3D_MODE

#ifdef FOG
    color = fog_dither(fog_apply_premultiplied(color, v_fog_pos, h));
#endif

#ifdef RENDER_CUTOFF
    color *= v_cutoff_opacity;
#endif

#ifdef INDICATOR_CUTOUT
    color = applyCutout(color);
#endif

    glFragColor = color;

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
