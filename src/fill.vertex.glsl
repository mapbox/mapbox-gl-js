#ifndef MAPBOX_GL_JS
attribute vec2 a_pos;
#else
precision highp float;
#endif

#ifdef MAPBOX_GL_JS
attribute vec2 a_pos;
#endif
uniform mat4 u_matrix;

void main() {
    gl_Position = u_matrix * vec4(a_pos, 0, 1);
}
