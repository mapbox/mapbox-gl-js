precision highp float;

uniform mat4 u_matrix;
uniform vec2 u_extrude_scale;
uniform float u_devicepixelratio;

attribute vec2 a_pos;

#ifdef ATTRIBUTE_A_COLOR
attribute lowp vec4 a_color;
#elif defined ATTRIBUTE_ZOOM_FUNCTION_A_COLOR0
uniform lowp float u_color_t;
attribute lowp vec4 a_color0;
attribute lowp vec4 a_color1;
attribute lowp vec4 a_color2;
attribute lowp vec4 a_color3;
#else
uniform lowp vec4 a_color;
#endif

#ifdef ATTRIBUTE_A_RADIUS
attribute mediump float a_radius;
#elif defined ATTRIBUTE_ZOOM_FUNCTION_A_RADIUS
uniform lowp float u_radius_t;
attribute mediump vec4 a_radius;
#else
uniform mediump float a_radius;
#endif

varying vec2 v_extrude;
varying lowp vec4 v_color;
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

#ifdef ATTRIBUTE_A_RADIUS
    mediump float radius = a_radius / 10.0;
#elif defined ATTRIBUTE_ZOOM_FUNCTION_A_RADIUS
    mediump float radius = evaluate_zoom_function_1(a_radius, u_radius_t) / 10.0;
#else
    mediump float radius = a_radius;
#endif

    // unencode the extrusion vector that we snuck into the a_pos vector
    v_extrude = vec2(mod(a_pos, 2.0) * 2.0 - 1.0);

    vec2 extrude = v_extrude * radius * u_extrude_scale;
    // multiply a_pos by 0.5, since we had it * 2 in order to sneak
    // in extrusion data
    gl_Position = u_matrix * vec4(floor(a_pos * 0.5), 0, 1);

    // gl_Position is divided by gl_Position.w after this shader runs.
    // Multiply the extrude by it so that it isn't affected by it.
    gl_Position.xy += extrude * gl_Position.w;

#ifdef ATTRIBUTE_A_COLOR
    v_color = a_color / 255.0;
#elif defined ATTRIBUTE_ZOOM_FUNCTION_A_COLOR0
    v_color = evaluate_zoom_function_4(a_color0, a_color1, a_color2, a_color3, u_color_t) / 255.0;
#else
    v_color = a_color;
#endif

    // This is a minimum blur distance that serves as a faux-antialiasing for
    // the circle. since blur is a ratio of the circle's size and the intent is
    // to keep the blur at roughly 1px, the two are inversely related.
    v_antialiasblur = 1.0 / u_devicepixelratio / radius;
}
