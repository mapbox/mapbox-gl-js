#ifdef GL_ES
precision mediump float;
#else
#define lowp
#define mediump
#define highp
#endif

uniform sampler2D u_image;
varying vec2 v_pos;

uniform int u_mode;
uniform vec2 u_dimension;
uniform float u_zoom;
uniform float u_azimuth;
uniform float u_zenith;
uniform float u_mipmap;
uniform float u_exaggeration;

uniform vec4 u_shadow;
uniform vec4 u_highlight;
uniform vec4 u_accent;

#define PI 3.141592653589793

const int mode_raw = 0;
const int mode_elevation = 1;
const int mode_dxdy = 2;
const int mode_slope = 3;
const int mode_aspect = 4;
const int mode_openness = 5;
const int mode_hillshade = 6;
const int mode_color = 7;
const int mode_coloropen = 8;

void main() {
    vec4 pixel = texture2D(u_image, v_pos, u_mipmap);

    vec2 deriv = ((pixel.rg * 2.0) - 1.0);

    float slope = atan(1.25 * length(deriv));
    float aspect = deriv.x != 0.0 ? atan(deriv.y, -deriv.x) : PI / 2.0 * (deriv.y > 0.0 ? 1.0 : -1.0);
    float openness = pixel.b;


    if (u_mode == mode_raw) {
        gl_FragColor = texture2D(u_image, v_pos, u_mipmap);
    } else if (u_mode == mode_dxdy) {
        gl_FragColor = clamp(vec4(deriv.x + 0.5, deriv.y + 0.5, deriv.x + 0.5, 1.0), 0.0, 1.0);
    } else if (u_mode == mode_slope) {
        gl_FragColor = vec4(1.0 - slope, 1.0 - slope, 1.0 - slope, 1.0);
    } else if (u_mode == mode_aspect) {
        float asp = abs(aspect) / PI;
        gl_FragColor = vec4(asp, asp, asp, 1.0);
    } else if (u_mode == mode_openness) {
        gl_FragColor = vec4(openness, openness, openness, 1.0);
    } else if (u_mode == mode_hillshade) {
        float hillshade = cos(u_zenith) * cos(slope) + sin(u_zenith) * sin(slope) * cos(u_azimuth - aspect);
        gl_FragColor = vec4(hillshade, hillshade, hillshade, 1.0);
    } else if (u_mode == mode_color) {
        float accent = cos(slope);
        // vec4 accent_color = clamp((1.0 - accent) * 2.0, 0.0, 1.0) * u_accent;
        vec4 accent_color = vec4(0.0);
        float shade = abs(mod((aspect + u_azimuth) / PI + 0.5, 2.0) - 1.0);
        vec4 shade_color = mix(u_shadow, u_highlight, shade) * (slope) * sin(u_zenith);
        gl_FragColor = accent_color * (1.0 - shade_color.a) + shade_color;
    } else if (u_mode == mode_coloropen) {
        float accent = cos((1.0 - openness) * 2.0);
        vec4 accent_color = u_exaggeration * (1.0 - accent) * u_accent;
        float shade = abs(mod((aspect + u_azimuth) / PI + 0.5, 2.0) - 1.0);
        vec4 shade_color = u_exaggeration * slope * sin(u_zenith) * mix(u_shadow, u_highlight, shade);
        gl_FragColor = accent_color * (1.0 - shade_color.a) + shade_color;
    } else {
        gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);
    }

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
