#include "_prelude_lighting.glsl"
#include "_prelude_shadow.fragment.glsl"

#define SDF_PX 8.0
#define SDF 1.0
#define ICON 0.0

uniform sampler2D u_texture;
#ifdef RENDER_TEXT_AND_SYMBOL
uniform sampler2D u_texture_icon;
#endif

uniform highp float u_gamma_scale;
uniform lowp float u_device_pixel_ratio;
uniform bool u_is_text;
uniform bool u_is_sdf;
uniform lowp float u_scale_factor;

// Boolean-config transition fragment alpha multiplier (dual-pass: originals + deltas).
uniform lowp float u_opacity_multiplier;
#ifdef ICON_TRANSITION
uniform float u_icon_transition;
#endif

#ifdef COLOR_ADJUSTMENT
uniform mat4 u_color_adj_mat;
#endif

#ifdef INDICATOR_CUTOUT
in highp float v_z_offset;
#else
#ifdef RENDER_SHADOWS
in highp float v_z_offset;
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

#ifdef RENDER_SHADOWS
uniform vec3 u_ground_shadow_factor;

in highp vec4 v_pos_light_view_0;
in highp vec4 v_pos_light_view_1;
in highp float v_depth;
#endif

#ifdef APPLY_LUT_ON_GPU
uniform highp sampler3D u_lutTexture;
#endif

/// Symbol paint properties.
in lowp float v_opacity;
in lowp vec4 v_fill_np_color;
in lowp vec4 v_halo_np_color;
in lowp float v_halo_width;
in lowp float v_halo_blur;
#ifdef LIGHTING_3D_MODE
in lowp float v_emissive_strength;
#endif

void main() {
    lowp float opacity = v_opacity;
    lowp vec4 fill_color = vec4(0.0);
    lowp vec4 halo_color = vec4(0.0);
    lowp float halo_width = 0.0;
    lowp float halo_blur = 0.0;
    if (u_is_sdf) {
        // Pre-multiply colors by alpha.
        fill_color = vec4(v_fill_np_color.rgb * v_fill_np_color.a, v_fill_np_color.a);
        halo_color = vec4(v_halo_np_color.rgb * v_halo_np_color.a, v_halo_np_color.a);
        halo_width = v_halo_width;
        halo_blur = v_halo_blur;
    }
    lowp float emissive_strength = 0.0;
#ifdef LIGHTING_3D_MODE
    emissive_strength = v_emissive_strength;
#endif

    vec4 out_color;
    float fade_opacity = v_gamma_scale_size_fade_opacity[2];

#ifdef RENDER_TEXT_AND_SYMBOL
    if (is_sdf == ICON) {
        vec2 tex_icon = v_tex_a_icon;
        lowp float alpha = opacity * fade_opacity * u_opacity_multiplier;
        glFragColor = texture(u_texture_icon, tex_icon) * alpha;

#ifdef OVERDRAW_INSPECTOR
        glFragColor = vec4(1.0);
#endif
        return;
    }
#endif

    vec2 cutout_factors = vec2(0.0);
#ifdef FEATURE_CUTOUT
    cutout_factors = get_cutout_factors(gl_FragCoord);
#endif

    if (u_is_sdf) {
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
    } else {
#ifdef ICON_TRANSITION
        vec4 a = texture(u_texture, v_tex_a) * (1.0 - u_icon_transition);
        vec4 b = texture(u_texture, v_tex_b) * u_icon_transition;
        out_color = (a + b);
#else
        out_color = texture(u_texture, v_tex_a);
#endif

#ifdef APPLY_LUT_ON_GPU
        out_color = applyLUT(u_lutTexture, out_color);
#endif

#ifdef COLOR_ADJUSTMENT
        out_color = u_color_adj_mat * out_color;
#endif
    }

    out_color *= opacity * fade_opacity * u_opacity_multiplier;

    #ifdef LIGHTING_3D_MODE
        out_color = apply_lighting_with_emission_ground(out_color, emissive_strength);
        #ifdef RENDER_SHADOWS
            float light = shadowed_light_factor(v_pos_light_view_0, v_pos_light_view_1, v_depth);
            light = mix(light, 1.0, cutout_factors.y);
            #ifdef TERRAIN
                out_color.rgb *= mix(u_ground_shadow_factor, vec3(1.0), light);
            #else
                out_color.rgb *= mix(v_z_offset != 0.0 ? u_ground_shadow_factor : vec3(1.0), vec3(1.0), light);
            #endif
        #endif // RENDER_SHADOWS
    #endif

#ifdef INDICATOR_CUTOUT
    out_color = applyCutout(out_color, v_z_offset);
#endif

#ifdef FEATURE_CUTOUT
    out_color = apply_feature_cutout(out_color, gl_FragCoord, cutout_factors.x);
#endif

    glFragColor = out_color;

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}