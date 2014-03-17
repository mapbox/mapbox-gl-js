precision mediump float;

uniform float u_brightness_low;
uniform float u_brightness_high;
uniform float u_spin;
uniform float u_saturation;
uniform sampler2D u_image;
varying vec2 v_pos;

vec3 u_high_vec;
vec3 u_low_vec;

vec3 greyscale;
vec3 original;
vec3 saturated;

float len;

void main() {

    u_high_vec = vec3(u_brightness_low, u_brightness_low, u_brightness_low);
    u_low_vec = vec3(u_brightness_high, u_brightness_high, u_brightness_high);

    vec4 color = texture2D(u_image, v_pos);

    float angle = u_spin * 3.14159265;
    float s = sin(angle), c = cos(angle);
    vec3 weights = (vec3(2.0 * c, -sqrt(3.0) * s - c, sqrt(3.0) * s - c) + 1.0) / 3.0;
    float len = length(color.rgb);

    color.rgb = vec3(
        dot(color.rgb, weights.xyz),
        dot(color.rgb, weights.zxy),
        dot(color.rgb, weights.yzx));

    float average = (color.r + color.g + color.b) / 3.0;

    if (u_saturation > 0.0) {
        color.rgb += (average - color.rgb) * (1.0 - 1.0 / (1.001 - u_saturation));
    } else {
        color.rgb += (average - color.rgb) * (-u_saturation);
    }

    gl_FragColor = vec4(
        mix(
            u_high_vec,
            u_low_vec,
            color.rgb
        ), color.a);
}
