#define SDF_PX 8.0
#define EDGE_GAMMA 0.105/DEVICE_PIXEL_RATIO

uniform bool u_is_halo;
#pragma mapbox: define highp vec4 fill_color
#pragma mapbox: define highp vec4 halo_color
#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp float halo_width
#pragma mapbox: define lowp float halo_blur

uniform sampler2D u_texture;
uniform highp float u_gamma_scale;
uniform bool u_is_text;

varying vec2 v_data0;
varying vec3 v_data1;

void main() {
    #pragma mapbox: initialize highp vec4 fill_color
    #pragma mapbox: initialize highp vec4 halo_color
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize lowp float halo_width
    #pragma mapbox: initialize lowp float halo_blur

    vec2 tex = v_data0.xy;
    float gamma_scale = v_data1.x;
    float size = v_data1.y;
    float fade_opacity = v_data1[2];

    float fontScale = u_is_text ? size / 24.0 : size;

    lowp vec4 color = fill_color;
    highp float gamma = EDGE_GAMMA / (fontScale * u_gamma_scale);
    // See https://blog.mapbox.com/drawing-text-with-signed-distance-fields-in-mapbox-gl-b0933af6f817
    // Values above 192 indicate _inside_ the shape, below indicates _outside_
    lowp float buff = (256.0 - 64.0) / 256.0;
    if (u_is_halo) {
        color = halo_color;
        gamma = (halo_blur * 1.19 / SDF_PX + EDGE_GAMMA) / (fontScale * u_gamma_scale);
        // At halo_width = 0, this is 6.0 / 8.0, e.g. same as no halo
        // At halo_width / fontScale = 6, this is 0, e.g. maximum
        // distance that can be encoded in the SDF.
        buff = (6.0 - halo_width / fontScale) / SDF_PX;
    }
    lowp float dist = texture2D(u_texture, tex).a;
    highp float gamma_scaled = gamma * gamma_scale;
    highp float alpha = smoothstep(
        clamp(buff - gamma_scaled, 0.0, 1.0),
        clamp(buff + gamma_scaled, 0.0, 1.0),
        dist);

    gl_FragColor = color * (alpha * opacity * fade_opacity);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
