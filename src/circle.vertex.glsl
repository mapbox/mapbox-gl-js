#ifdef GL_ES
precision highp float;
#else
#define lowp
#define mediump
#define highp
#endif

#ifndef MAPBOX_GL_JS
// set by gl_util
uniform float u_size;
#else
uniform mat4 u_matrix;
uniform vec2 u_extrude_scale;
uniform float u_devicepixelratio;
#endif

attribute vec2 a_pos;

#ifndef MAPBOX_GL_JS
uniform mat4 u_matrix;
uniform mat4 u_exmatrix;
#else
#pragma mapbox: define color lowp
#pragma mapbox: define radius mediump
#endif

varying vec2 v_extrude;
#ifdef MAPBOX_GL_JS
varying lowp float v_antialiasblur;
#endif

void main(void) {
#ifdef MAPBOX_GL_JS

    #pragma mapbox: initialize color
    #pragma mapbox: initialize radius

#endif
    // unencode the extrusion vector that we snuck into the a_pos vector
    v_extrude = vec2(mod(a_pos, 2.0) * 2.0 - 1.0);

#ifndef MAPBOX_GL_JS
    vec4 extrude = u_exmatrix * vec4(v_extrude * u_size, 0, 0);
#else
    vec2 extrude = v_extrude * radius * u_extrude_scale;
#endif
    // multiply a_pos by 0.5, since we had it * 2 in order to sneak
    // in extrusion data
    gl_Position = u_matrix * vec4(floor(a_pos * 0.5), 0, 1);

#ifndef MAPBOX_GL_JS
    // gl_Position is divided by gl_Position.w after this shader runs.
    // Multiply the extrude by it so that it isn't affected by it.
    gl_Position += extrude * gl_Position.w;
#else
    gl_Position.xy += extrude;

    // This is a minimum blur distance that serves as a faux-antialiasing for
    // the circle. since blur is a ratio of the circle's size and the intent is
    // to keep the blur at roughly 1px, the two are inversely related.
    v_antialiasblur = 1.0 / u_devicepixelratio / radius;
#endif
}
