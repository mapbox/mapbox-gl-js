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

#ifdef FEATURE_CUTOUT
    // Here we only apply cutout when the background layer is rendered with viewport pitch alignment.
    // So we don't need to consider the depth difference between the fragment and the cutout depth, 
    // and can directly use the cutout factor from texture to modulate the color.
    vec2 uv = gl_FragCoord.xy * u_inv_viewport_size.xy;
#ifdef FLIP_Y
    uv.y = 1.0 - uv.y;
#endif
    float factorTex = min(texture(u_cutout_factor_image, uv).r, 1.0);
    float cutoutFactor = (1.0 - u_feature_cutout_params.x) * factorTex;
    out_color = u_color * (1.0 - cutoutFactor);
#else // FEATURE_CUTOUT
#ifdef LIGHTING_3D_MODE
    out_color = v_color;
#else
    out_color = u_color;
#endif
#ifdef FOG
    out_color = fog_dither(fog_apply_premultiplied(out_color, v_fog_pos));
#endif
#endif // FEATURE_CUTOUT

    glFragColor = out_color * u_opacity;
#ifdef USE_MRT1
    out_Target1 = vec4(u_emissive_strength * glFragColor.a, 0.0, 0.0, glFragColor.a);
#endif

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
