precision highp float;

uniform mat4 u_matrix;
uniform vec2 u_extrude_scale;
uniform float u_devicepixelratio;

attribute vec2 a_pos;

#pragma mapbox: define(color)
#pragma mapbox: define(radius)

varying vec2 v_extrude;
varying lowp float v_antialiasblur;

float evaluate_zoom_function_1(const vec4 values, const float t) {
    if (t < 1.0) {
        return mix(values[0], values[1], t);
    } else if (t < 2.0) {
        return mix(values[1], values[2], t - 1.0);
    } else {
        return mix(values[2], values[3], t - 2.0);
    }
}

vec4 evaluate_zoom_function_4(const vec4 value0, const vec4 value1, const vec4 value2, const vec4 value3, const float t) {
    if (t < 1.0) {
        return mix(value0, value1, t);
    } else if (t < 2.0) {
        return mix(value1, value2, t - 1.0);
    } else {
        return mix(value2, value3, t - 2.0);
    }
}

void main(void) {

    #pragma mapbox: initialize(color)
    #pragma mapbox: initialize(radius)

    // unencode the extrusion vector that we snuck into the a_pos vector
    v_extrude = vec2(mod(a_pos, 2.0) * 2.0 - 1.0);

    vec2 extrude = v_extrude * radius * u_extrude_scale;
    // multiply a_pos by 0.5, since we had it * 2 in order to sneak
    // in extrusion data
    gl_Position = u_matrix * vec4(floor(a_pos * 0.5), 0, 1);

    gl_Position.xy += extrude;

    // This is a minimum blur distance that serves as a faux-antialiasing for
    // the circle. since blur is a ratio of the circle's size and the intent is
    // to keep the blur at roughly 1px, the two are inversely related.
    v_antialiasblur = 1.0 / u_devicepixelratio / radius;
}
