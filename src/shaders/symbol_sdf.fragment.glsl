#pragma mapbox: define lowp vec4 fill_color
#pragma mapbox: define lowp vec4 halo_color
uniform bool u_is_halo;

uniform sampler2D u_texture;
uniform sampler2D u_fadetexture;
uniform lowp float u_opacity;
uniform lowp float u_buffer;
uniform lowp float u_gamma;

varying vec2 v_tex;
varying vec2 v_fade_tex;
varying float v_gamma_scale;

void main() {
    #pragma mapbox: initialize lowp vec4 fill_color
    #pragma mapbox: initialize lowp vec4 halo_color

    lowp vec4 color = fill_color;
    if (u_is_halo) {
        color = halo_color;
    }

    lowp float dist = texture2D(u_texture, v_tex).a;
    lowp float fade_alpha = texture2D(u_fadetexture, v_fade_tex).a;
    lowp float gamma = u_gamma * v_gamma_scale;
    lowp float alpha = smoothstep(u_buffer - gamma, u_buffer + gamma, dist) * fade_alpha;

    gl_FragColor = color * (alpha * u_opacity);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
