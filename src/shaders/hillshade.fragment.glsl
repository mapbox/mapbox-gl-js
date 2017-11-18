
#ifdef GL_ES
precision highp float;
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

uniform vec3 u_light;

uniform vec4 u_shadow;
uniform vec4 u_highlight;
uniform vec4 u_accent;

#define PI 3.141592653589793

const int mode_raw = 0;
const int mode_color = 1;
const float Xn = 0.950470; // D65 standard referent
const float Yn = 1.0;
const float Zn = 1.088830;
const float t0 = 4.0 / 29.0;
const float t1 = 6.0 / 29.0;
const float t2 = 3.0 * t1 * t1;
const float t3 = pow(t1, 3.0);
const float deg2rad = PI / 180.0;
const float rad2deg = 180.0 / PI;

// Utilities
float xyz2lab(const float t) {
    return t > t3 ? pow(t, 1.0 / 3.0) : t / t2 + t0;
}

float lab2xyz(const float t) {
    return t > t1 ? t * t * t : t2 * (t - t0);
}

float xyz2rgb(const float x) {
    return 255.0 * (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1.0 / 2.4) - 0.055);
}

float rgb2xyz(const float _x) {
    float x = _x / 255.0;
    return x <= 0.04045 ? x / 12.92 : pow((x + 0.055) / 1.055, 2.4);
}

bool isnan( float val ){
  return ( val < 0.0 || 0.0 < val || val == 0.0 ) ? false : true;
  // important: some nVidias failed to cope with version below.
  // Probably wrong optimization.
  /*return ( val <= 0.0 || 0.0 <= val ) ? false : true;*/
}

vec4 rgbToLab(const vec4 rgbColor) {
    float b = rgb2xyz(rgbColor.r);
    float a = rgb2xyz(rgbColor.g);
    float l = rgb2xyz(rgbColor.b);
    float x = xyz2lab((0.4124564 * b + 0.3575761 * a + 0.1804375 * l) / Xn);
    float y = xyz2lab((0.2126729 * b + 0.7151522 * a + 0.0721750 * l) / Yn);
    float z = xyz2lab((0.0193339 * b + 0.1191920 * a + 0.9503041 * l) / Zn);

    return vec4(
        116.0 * y - 16.0,
        500.0 * (x - y),
        200.0 * (y - z),
        rgbColor.a
    );

}

vec4 labToRgb(const vec4 labColor) {
    float y = (labColor.r + 16.0) / 116.0;
    float x = isnan(labColor.g) ? y : y + labColor.g / 500.0;
    float z = isnan(labColor.b) ? y : y - labColor.b / 200.0;
    y = Yn * lab2xyz(y);
    x = Xn * lab2xyz(x);
    z = Zn * lab2xyz(z);
    return vec4(
        xyz2rgb(3.2404542 * x - 1.5371385 * y - 0.4985314 * z), // D65 -> sRGB
        xyz2rgb(-0.9692660 * x + 1.8760108 * y + 0.0415560 * z),
        xyz2rgb(0.0556434 * x - 0.2040259 * y + 1.0572252 * z),
        labColor.a
    );
}

void main() {
    vec4 pixel = texture2D(u_image, v_pos);

    vec2 deriv = ((pixel.rg * 2.0) - 1.0);

    // we multiply the slope by a scale factor based on the cosin of the pixel's approximate latitude
    float scaleFactor = cos(radians((u_latrange[0] - u_latrange[1]) * (1.0 - v_pos.y) + u_latrange[1]));
    float slope = atan(1.25 * length(deriv)) / scaleFactor;
    float aspect = deriv.x != 0.0 ? atan(deriv.y, -deriv.x) : PI / 2.0 * (deriv.y > 0.0 ? 1.0 : -1.0);

    float intensity = u_light.x;
    // We add PI to make this angle match the global light object, which adds PI/2 to the light's azimuthal
    // position property to account for 0deg corresponding to north/the top of the viewport in the style spec
    // and the original shader was written to accept (-illuminationDirection - 90) as the azimuthal.
    float azimuth = u_light.y + PI;
    float polar = u_light.z;

    if (u_mode == mode_raw) {
        gl_FragColor = texture2D(u_image, v_pos);
    } else if (u_mode == mode_color) {
        float accent = cos(slope);
        vec4 accent_color = intensity * clamp((1.0 - accent) * 2.0, 0.0, 1.0) * u_accent;
        float shade = abs(mod((aspect + azimuth) / PI + 0.5, 2.0) - 1.0);
        vec4 shade_color = labToRgb(mix(rgbToLab(u_shadow*255.0), rgbToLab(u_highlight*255.0), shade))/255.0 * slope * sin(polar) * mix(0.0, 2.0, intensity);
        // vec4 shade_color = mix(u_shadow, u_highlight, shade) * slope * sin(polar) * mix(0.0, 2.0, intensity);
        gl_FragColor = accent_color * (1.0 - shade_color.a) + shade_color;
    } else {
        gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);
    }

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
