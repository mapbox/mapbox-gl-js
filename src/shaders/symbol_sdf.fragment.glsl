#define SDF_PX 8.0
#define BLUR_OFFSET 1.19
#define HALO_OFFSET 6.0
#define GAMMA 0.105/DEVICE_PIXEL_RATIO

uniform bool u_is_halo;
#pragma mapbox: define lowp vec4 fill_color
#pragma mapbox: define lowp vec4 halo_color
#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp float halo_width
#pragma mapbox: define lowp float halo_blur

uniform sampler2D u_texture;
uniform sampler2D u_fadetexture;
uniform lowp float u_font_scale;
uniform lowp float u_gamma_scale;

varying vec2 v_tex;
varying vec2 v_fade_tex;
varying float v_gamma_scale;

void main() {
    #pragma mapbox: initialize lowp vec4 fill_color
    #pragma mapbox: initialize lowp vec4 halo_color
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize lowp float halo_width
    #pragma mapbox: initialize lowp float halo_blur

    lowp vec4 color = fill_color;
    lowp float gamma = GAMMA / u_gamma_scale;
    lowp float buff = (256.0 - 64.0) / 256.0;
    if (u_is_halo) {
        color = halo_color;
        gamma = (halo_blur * BLUR_OFFSET / SDF_PX + GAMMA) / u_gamma_scale;
        buff = (HALO_OFFSET - halo_width / u_font_scale) / SDF_PX;
    }

    lowp float dist = texture2D(u_texture, v_tex).a;
    lowp float fade_alpha = texture2D(u_fadetexture, v_fade_tex).a;
    lowp float gamma_scaled = gamma * v_gamma_scale;
    lowp float alpha = smoothstep(buff - gamma_scaled, buff + gamma_scaled, dist) * fade_alpha;

    gl_FragColor = color * (alpha * opacity);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
