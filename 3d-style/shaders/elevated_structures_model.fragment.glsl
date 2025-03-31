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

void main() {
    vec3 color = vec3(241.0 / 255.0, 236.0 / 255.0, 225.0 / 255.0);
#ifdef LIGHTING_3D_MODE
    vec3 normal = normalize(v_normal);

#ifdef RENDER_SHADOWS
    float shadowed_lighting_factor = shadowed_light_factor_normal(normal, v_pos_light_view_0, v_pos_light_view_1, v_depth);
    color.rgb = apply_lighting(color.rgb, normal, shadowed_lighting_factor);
#else // RENDER_SHADOWS
    color = apply_lighting(color, normal);
#endif // RENDER_SHADOWS

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