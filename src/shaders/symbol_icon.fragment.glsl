#include "_prelude_lighting.glsl"

uniform sampler2D u_texture;
#ifdef ICON_TRANSITION
uniform float u_icon_transition;
#endif

varying float v_fade_opacity;
varying vec2 v_tex_a;
#ifdef ICON_TRANSITION
varying vec2 v_tex_b;
#endif

#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp float emissive_strength

void main() {
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize lowp float emissive_strength

    lowp float alpha = opacity * v_fade_opacity;
    vec4 out_color;

#ifdef ICON_TRANSITION
    vec4 a = texture2D(u_texture, v_tex_a) * (1.0 - u_icon_transition);
    vec4 b = texture2D(u_texture, v_tex_b) * u_icon_transition;
    out_color = (a + b) * alpha;
#else
    out_color = texture2D(u_texture, v_tex_a) * alpha;
#endif

#ifdef LIGHTING_3D_MODE
    out_color = apply_lighting_with_emission_ground(out_color, emissive_strength);
#endif

    gl_FragColor = out_color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
