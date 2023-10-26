#include "_prelude_fog.fragment.glsl"
#include "_prelude_shadow.fragment.glsl"
#include "_prelude_lighting.glsl"

uniform sampler2D u_image0;
varying vec2 v_pos0;

#ifdef FOG
varying float v_fog_opacity;
#endif

#ifdef RENDER_SHADOWS
varying vec4 v_pos_light_view_0;
varying vec4 v_pos_light_view_1;
varying float v_depth;
#endif

uniform vec3 u_ground_shadow_factor;

void main() {
    vec4 image_color = texture2D(u_image0, v_pos0);
    vec4 color;

#ifdef LIGHTING_3D_MODE
    const vec3 normal = vec3(0.0, 0.0, 1.0);

#ifdef RENDER_SHADOWS
    float cutoffOpacity = 1.0;
#ifdef RENDER_CUTOFF
    cutoffOpacity = cutoff_opacity(u_cutoff_params, v_depth);
#endif // RENDER_CUTOFF
#ifdef LIGHTING_3D_ALPHA_EMISSIVENESS
    // Drape texture also contains the flood light color already
    // For this reason we decouple the emissive and flood lights areas
    // from the areas that should be lit with lights.
    // In the end we add the results instead of mixing them.
    vec3 unlit_base = image_color.rgb * (1.0 - image_color.a);
    vec3 emissive_base = image_color.rgb * image_color.a;
    float ndotl = u_shadow_direction.z;
    float occlusion = ndotl < 0.0 ? 1.0 : shadow_occlusion(v_pos_light_view_0, v_pos_light_view_1, v_depth, 0.0);
    ndotl = max(0.0, ndotl);
    // "lit" uses pretty much "shadowed_light_factor_normal_unbiased" as the directional component.
    vec3 lit = apply_lighting(unlit_base, normal, mix(1.0, (1.0 - (u_shadow_intensity * occlusion)) * ndotl, cutoffOpacity));
    vec3 emissive = compute_emissive_draped(emissive_base, 1.0 - u_shadow_intensity, occlusion, u_ground_shadow_factor);
    color.rgb = lit + emissive;
    color.a = 1.0;
#else // LIGHTING_3D_ALPHA_EMISSIVENESS
    float lighting_factor = shadowed_light_factor_normal_unbiased(normal, v_pos_light_view_0, v_pos_light_view_1, v_depth);
    color = apply_lighting(image_color, normal, mix(1.0, lighting_factor, cutoffOpacity));
#endif // !LIGHTING_3D_ALPHA_EMISSIVENESS
#else // RENDER_SHADOWS
    float lighting_factor = u_lighting_directional_dir.z;
    color = apply_lighting(image_color, normal, lighting_factor);
#ifdef LIGHTING_3D_ALPHA_EMISSIVENESS
    color.rgb = mix(color.rgb, image_color.rgb, image_color.a);
    color.a = 1.0;
#endif // LIGHTING_3D_ALPHA_EMISSIVENESS
#endif // !RENDER_SHADOWS

#else // LIGHTING_3D_MODE
    color = image_color;
#endif // !LIGHTING_3D_MODE

#ifdef FOG
#ifdef ZERO_EXAGGERATION
    color = fog_dither(fog_apply_premultiplied(color, v_fog_pos));
#else
    color = fog_dither(fog_apply_from_vert(color, v_fog_opacity));
#endif
#endif
    gl_FragColor = color;
#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
