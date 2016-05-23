#ifdef GL_ES
precision highp float;
#else
#define lowp
#define mediump
#define highp
#endif

#ifndef MAPBOX_GL_JS
attribute vec2 a_pos;
#endif

#ifdef MAPBOX_GL_JS
attribute vec2 a_pos;
#endif
uniform mat4 u_matrix;

void main() {
    gl_Position = u_matrix * vec4(a_pos, 0, 1);
}
