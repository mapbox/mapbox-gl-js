// set by gl_util
attribute vec2 a_pos;
attribute vec4 a_color;
attribute float a_blur;
attribute float a_size;

uniform mat4 u_matrix;
uniform mat4 u_exmatrix;

varying vec2 v_extrude;
varying vec4 v_color;
varying float v_blur;
varying float v_size;

void main(void) {
    // unencode the extrusion vector that we snuck into the a_pos vector
    v_extrude = vec2(mod(a_pos, 2.0) * 2.0 - 1.0);

    vec4 extrude = u_exmatrix * vec4(v_extrude * a_size, 0, 0);
    // multiply a_pos by 0.5, since we had it * 2 in order to sneak
    // in extrusion data
    gl_Position = u_matrix * vec4(a_pos * 0.5, 0, 1);

    // gl_Position is divided by gl_Position.w after this shader runs.
    // Multiply the extrude by it so that it isn't affected by it.
    gl_Position += extrude * gl_Position.w;

    v_color = a_color / 255.0;
    v_blur = a_blur / 255.0;
    v_size = a_size;
}
