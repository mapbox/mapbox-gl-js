
#ifdef GL_ES
precision mediump float;
#else
#define lowp
#define mediump
#define highp
#endif

uniform sampler2D u_image;
varying vec2 v_pos;
uniform vec2 u_latrange;

uniform int u_mode;
uniform float u_mipmap;
uniform float u_lightintensity;
uniform vec3 u_lightpos;

uniform vec4 u_shadow;
uniform vec4 u_highlight;
uniform vec4 u_accent;

#define PI 3.141592653589793

const int mode_raw = 0;
const int mode_color = 1;

void main() {
    vec4 pixel = texture2D(u_image, v_pos);

    vec2 deriv = ((pixel.rg * 2.0) - 1.0);

    // we multiply the slope by a scale factor based on the cosin of the pixel's approximate latitude
    float scaleFactor = cos(radians((u_latrange[0]-u_latrange[1])*(1.0-v_pos.y)+u_latrange[1]));
    float slope = atan(1.25 * length(deriv)) / scaleFactor;
    float aspect = deriv.x != 0.0 ? atan(deriv.y, -deriv.x) : PI / 2.0 * (deriv.y > 0.0 ? 1.0 : -1.0);

    float azimuth =  u_lightpos.y;
    float polar = u_lightpos.z;

    if (u_mode == mode_raw) {
        gl_FragColor = texture2D(u_image, v_pos);
    } else if (u_mode == mode_color) {
        float accent = cos(slope);
        vec4 accent_color = u_lightintensity * clamp((1.0 - accent) * 2.0, 0.0, 1.0) * u_accent;
        float shade = abs(mod((aspect + azimuth) / PI + 0.5, 2.0) - 1.0);
        vec4 shade_color = mix(u_shadow, u_highlight, shade) * slope * sin(polar);
        gl_FragColor = accent_color * (1.0 - shade_color.a) + shade_color;
    } else {
        gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);
    }

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
