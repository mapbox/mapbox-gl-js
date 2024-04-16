#include "_prelude_lighting.glsl"

uniform sampler2D u_texture;
#ifdef ICON_TRANSITION
uniform float u_icon_transition;
#endif

in float v_fade_opacity;
in vec2 v_tex_a;
#ifdef ICON_TRANSITION
in vec2 v_tex_b;
#endif

#ifdef COLOR_ADJUSTMENT
uniform mat4 u_color_adj_mat;
#endif

#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp float emissive_strength

void main() {
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize lowp float emissive_strength

    lowp float alpha = opacity * v_fade_opacity;
    vec4 out_color;

#ifdef ICON_TRANSITION
    vec4 a = texture(u_texture, v_tex_a) * (1.0 - u_icon_transition);
    vec4 b = texture(u_texture, v_tex_b) * u_icon_transition;
    out_color = (a + b);
#else
    out_color = texture(u_texture, v_tex_a);
#endif

#ifdef COLOR_ADJUSTMENT
    out_color = u_color_adj_mat * out_color;
#endif

    out_color *= alpha;

#ifdef LIGHTING_3D_MODE
    out_color = apply_lighting_with_emission_ground(out_color, emissive_strength);
#endif

    glFragColor = out_color;

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
