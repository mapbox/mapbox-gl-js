precision highp float;

uniform mat4 u_matrix;
uniform vec2 u_extrude_scale;
uniform float u_devicepixelratio;

attribute vec2 a_pos;

#pragma mapbox: define(color)
#pragma mapbox: define(radius)

varying vec2 v_extrude;
varying lowp float v_antialiasblur;

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
