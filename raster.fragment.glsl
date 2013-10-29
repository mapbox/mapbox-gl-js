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

    // http://www.laurenscorijn.com/articles/colormath-basics
    original = texture2D(u_image, v_pos).xyz;
    len = length(original) / 2.0;

    greyscale = vec3(len, len, len);

    saturated = (u_saturation * original) + ((1.0 - u_saturation) * greyscale);

    gl_FragColor = vec4(
        mix(
            u_high_vec,
            u_low_vec,
            // texture2D(u_image, v_pos).xyz
            saturated
        ) * mat3(
            1, 0, 0,
            0, cos(u_spin), -sin(u_spin),
            0, sin(u_spin), cos(u_spin)), 1.0);
}
