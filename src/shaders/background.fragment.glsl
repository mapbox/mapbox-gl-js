#include "_prelude_fog.fragment.glsl"
#include "_prelude_lighting.glsl"

uniform vec4 u_color;
uniform float u_opacity;
uniform mediump float u_emissive_strength;

#ifdef LIGHTING_3D_MODE
in vec4 v_color;
#endif

void main() {
    vec4 out_color;
#ifdef LIGHTING_3D_MODE
    out_color = v_color;
#else
    out_color = u_color;
#endif
#ifdef FOG
    out_color = fog_dither(fog_apply_premultiplied(out_color, v_fog_pos));
#endif
    glFragColor = out_color * u_opacity;
#ifdef USE_MRT1
    out_Target1 = vec4(u_emissive_strength * glFragColor.a, 0.0, 0.0, glFragColor.a);
#endif

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
