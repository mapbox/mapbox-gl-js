#include "_prelude_lighting.glsl"

#define SDF_PX 8.0

#define SDF 1.0
#define ICON 0.0

uniform sampler2D u_texture;
uniform sampler2D u_texture_icon;
uniform highp float u_gamma_scale;
uniform lowp float u_device_pixel_ratio;
uniform bool u_is_halo;

#if __VERSION__ >= 300
flat varying float v_draw_halo;
#endif
varying vec4 v_data0;
varying vec4 v_data1;

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

    float fade_opacity = v_data1[2];

    if (v_data1.w == ICON) {
        vec2 tex_icon = v_data0.zw;
        lowp float alpha = opacity * fade_opacity;
        gl_FragColor = texture2D(u_texture_icon, tex_icon) * alpha;

#ifdef OVERDRAW_INSPECTOR
        gl_FragColor = vec4(1.0);
#endif
        return;
    }

    vec2 tex = v_data0.xy;

    float EDGE_GAMMA = 0.105 / u_device_pixel_ratio;

    float gamma_scale = v_data1.x;
    float size = v_data1.y;

    float fontScale = size / 24.0;

    lowp vec4 color = fill_color;
    highp float gamma = EDGE_GAMMA / (fontScale * u_gamma_scale);
    lowp float buff = (256.0 - 64.0) / 256.0;

    bool draw_halo;
#if __VERSION__ >= 300
    draw_halo = v_draw_halo > 0.0;
#else
    draw_halo = u_is_halo;
#endif
    if (draw_halo) {
        color = halo_color;
        gamma = (halo_blur * 1.19 / SDF_PX + EDGE_GAMMA) / (fontScale * u_gamma_scale);
        buff = (6.0 - halo_width / fontScale) / SDF_PX;
    }

    lowp float dist = texture2D(u_texture, tex).a;
    highp float gamma_scaled = gamma * gamma_scale;
    highp float alpha = smoothstep(buff - gamma_scaled, buff + gamma_scaled, dist);

    vec4 out_color = color * (alpha * opacity * fade_opacity);

#ifdef LIGHTING_3D_MODE
    out_color = apply_lighting_with_emission_ground(out_color, emissive_strength);
#endif

    gl_FragColor = out_color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
