#include "_prelude_fog.fragment.glsl"
#include "_prelude_lighting.glsl"
#include "_prelude_shadow.fragment.glsl"

#pragma mapbox: define highp vec4 color
#pragma mapbox: define lowp float opacity

uniform float u_emissive_strength;

#ifdef RENDER_SHADOWS
uniform vec3 u_ground_shadow_factor;

in highp vec4 v_pos_light_view_0;
in highp vec4 v_pos_light_view_1;
in highp float v_depth;
#endif

#ifdef ELEVATED_ROADS
in highp float v_road_z_offset;
#endif

#ifdef INDICATOR_CUTOUT
in highp float v_z_offset;
#endif

void main() {
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize lowp float opacity

    vec4 out_color = color;

#ifdef LIGHTING_3D_MODE
    out_color = apply_lighting_with_emission_ground(out_color, u_emissive_strength);
#ifdef RENDER_SHADOWS
    float light = shadowed_light_factor(v_pos_light_view_0, v_pos_light_view_1, v_depth);
    out_color.rgb *= mix(u_ground_shadow_factor, vec3(1.0), light);
#endif // RENDER_SHADOWS
#endif // LIGHTING_3D_MODE

#ifdef FOG
    out_color = fog_dither(fog_apply_premultiplied(out_color, v_fog_pos));
#endif

    out_color *= opacity;

#ifdef INDICATOR_CUTOUT
    // apply cutout if the fragment is not an underground polygon (no need)
    if (v_z_offset >= 0.0) {
        out_color = applyCutout(out_color, v_z_offset);
    }
#endif

#ifdef FEATURE_CUTOUT
    out_color = apply_feature_cutout(out_color, gl_FragCoord);
#endif

    glFragColor = out_color;

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}

