#include "_prelude_lighting.glsl"
#include "_prelude_shadow.fragment.glsl"

#define SDF_PX 8.0
#define SDF 1.0
#define ICON 0.0

uniform sampler2D u_texture;
uniform sampler2D u_texture_icon;
uniform highp float u_gamma_scale;
uniform lowp float u_device_pixel_ratio;
uniform bool u_is_text;
uniform bool u_is_halo;
uniform lowp float u_scale_factor;
#ifdef ICON_TRANSITION
uniform float u_icon_transition;
#endif

#ifdef COLOR_ADJUSTMENT
uniform mat4 u_color_adj_mat;
#endif

#ifdef INDICATOR_CUTOUT
in highp float v_z_offset;
#else
#ifdef Z_OFFSET
#ifdef RENDER_SHADOWS
in highp float v_z_offset;
#endif
#endif
#endif

in vec2 v_tex_a;
#ifdef ICON_TRANSITION
in vec2 v_tex_b;
#endif

in float v_draw_halo;
in vec3 v_gamma_scale_size_fade_opacity;
#ifdef RENDER_TEXT_AND_SYMBOL
in float is_sdf;
in vec2 v_tex_a_icon;
#endif

#ifdef Z_OFFSET
#ifdef RENDER_SHADOWS
uniform vec3 u_ground_shadow_factor;

in highp vec4 v_pos_light_view_0;
in highp vec4 v_pos_light_view_1;
in highp float v_depth;
#endif
#endif

#pragma mapbox: define highp vec4 fill_color
#pragma mapbox: define highp vec4 halo_color
#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp float halo_width
#pragma mapbox: define lowp float halo_blur
#pragma mapbox: define lowp float emissive_strength

void main() {
    #pragma mapbox: initialize highp vec4 fill_color
    #pragma mapbox: initialize highp vec4 halo_color
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize lowp float halo_width
    #pragma mapbox: initialize lowp float halo_blur
    #pragma mapbox: initialize lowp float emissive_strength

    vec4 out_color;
    float fade_opacity = v_gamma_scale_size_fade_opacity[2];

#ifdef RENDER_TEXT_AND_SYMBOL
    if (is_sdf == ICON) {
        vec2 tex_icon = v_tex_a_icon;
        lowp float alpha = opacity * fade_opacity;
        glFragColor = texture(u_texture_icon, tex_icon) * alpha;

#ifdef OVERDRAW_INSPECTOR
        glFragColor = vec4(1.0);
#endif
        return;
    }
#endif

#ifdef RENDER_SDF
    float EDGE_GAMMA = 0.105 / u_device_pixel_ratio;

    float gamma_scale = v_gamma_scale_size_fade_opacity.x;
    float size = v_gamma_scale_size_fade_opacity.y;

    float fontScale = u_is_text ? size / 24.0 : size;

    out_color = fill_color;
    highp float gamma = EDGE_GAMMA / (fontScale * u_gamma_scale);
    lowp float buff = (256.0 - 64.0) / 256.0;

    bool draw_halo = v_draw_halo > 0.0;
    if (draw_halo) {
        out_color = halo_color;
        gamma = (halo_blur * u_scale_factor * 1.19 / SDF_PX + EDGE_GAMMA) / (fontScale * u_gamma_scale);
        buff = (6.0 - halo_width * u_scale_factor / fontScale) / SDF_PX;
    }

    lowp float dist = texture(u_texture, v_tex_a).r;
    highp float gamma_scaled = gamma * gamma_scale;
    highp float alpha = smoothstep(buff - gamma_scaled, buff + gamma_scaled, dist);

    out_color *= alpha;
#else // RENDER_SDF
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
#endif

    out_color *= opacity * fade_opacity;

    #ifdef LIGHTING_3D_MODE
        out_color = apply_lighting_with_emission_ground(out_color, emissive_strength);
        #ifdef Z_OFFSET
        #ifdef RENDER_SHADOWS
            float light = shadowed_light_factor(v_pos_light_view_0, v_pos_light_view_1, v_depth);
            out_color.rgb *= mix(abs(v_z_offset) > 0.0 ? u_ground_shadow_factor : vec3(1.0), vec3(1.0), light);
        #endif // RENDER_SHADOWS
        #endif // Z_OFFSET
    #endif

#ifdef INDICATOR_CUTOUT
    out_color = applyCutout(out_color, v_z_offset);
#endif

    glFragColor = out_color;

    #ifdef OVERDRAW_INSPECTOR
        glFragColor = vec4(1.0);
    #endif

    HANDLE_WIREFRAME_DEBUG;
}
