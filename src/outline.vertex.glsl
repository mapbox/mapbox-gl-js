#ifdef GL_ES
precision highp float;
#else
#define lowp
#define mediump
#define highp
#endif

attribute vec2 a_pos;
#ifdef MAPBOX_GL_JS

#endif
uniform mat4 u_matrix;
uniform vec2 u_world;

varying vec2 v_pos;

void main() {
    gl_Position = u_matrix * vec4(a_pos, 0, 1);
#ifndef MAPBOX_GL_JS
    v_pos = (gl_Position.xy / gl_Position.w + 1.0) / 2.0 * u_world;
#else
    v_pos = (gl_Position.xy/gl_Position.w + 1.0) / 2.0 * u_world;
#endif
}
