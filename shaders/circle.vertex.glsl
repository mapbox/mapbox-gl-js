precision highp float;

uniform mat4 u_matrix;
uniform mat4 u_exmatrix;

attribute vec2 a_pos;

#ifdef ATTRIBUTE_COLOR
attribute lowp vec4 a_color;
#else
uniform lowp vec4 a_color;
#endif

#ifdef ATTRIBUTE_RADIUS
attribute lowp float a_radius;
#else
uniform lowp float a_radius;
#endif

varying vec2 v_extrude;
varying lowp vec4 v_color;

void main(void) {
    // unencode the extrusion vector that we snuck into the a_pos vector
    v_extrude = vec2(mod(a_pos, 2.0) * 2.0 - 1.0);

    vec4 extrude = u_exmatrix * vec4(v_extrude * a_radius / 10.0, 0, 0);
    // multiply a_pos by 0.5, since we had it * 2 in order to sneak
    // in extrusion data
    gl_Position = u_matrix * vec4(floor(a_pos * 0.5), 0, 1);

    // gl_Position is divided by gl_Position.w after this shader runs.
    // Multiply the extrude by it so that it isn't affected by it.
    gl_Position += extrude * gl_Position.w;

    v_color = a_color / 255.0;
}
