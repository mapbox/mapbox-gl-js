precision highp float;

uniform mat4 u_matrix;
uniform mat4 u_exmatrix;
uniform float u_devicepixelratio;

attribute vec2 a_pos;

#ifdef ATTRIBUTE_COLOR
attribute lowp vec4 a_color;
#else
uniform lowp vec4 a_color;
#endif

#ifdef ATTRIBUTE_RADIUS
attribute mediump float a_radius;
#else
uniform mediump float a_radius;
#endif

varying vec2 v_extrude;
varying lowp vec4 v_color;
varying lowp float v_antialiasblur;

void main(void) {

#ifdef ATTRIBUTE_RADIUS
    mediump float radius = a_radius / 10.0;
#else
    mediump float radius = a_radius;
#endif

    // unencode the extrusion vector that we snuck into the a_pos vector
    v_extrude = vec2(mod(a_pos, 2.0) * 2.0 - 1.0);

    vec4 extrude = u_exmatrix * vec4(v_extrude * radius, 0, 0);
    // multiply a_pos by 0.5, since we had it * 2 in order to sneak
    // in extrusion data
    gl_Position = u_matrix * vec4(floor(a_pos * 0.5), 0, 1);

    // gl_Position is divided by gl_Position.w after this shader runs.
    // Multiply the extrude by it so that it isn't affected by it.
    gl_Position += extrude * gl_Position.w;

#ifdef ATTRIBUTE_COLOR
    v_color = a_color / 255.0;
#else
    v_color = a_color;
#endif

    // This is a minimum blur distance that serves as a faux-antialiasing for
    // the circle. since blur is a ratio of the circle's size and the intent is
    // to keep the blur at roughly 1px, the two are inversely related.
    v_antialiasblur = 1.0 / u_devicepixelratio / radius;
}
