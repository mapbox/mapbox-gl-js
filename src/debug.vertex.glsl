#ifdef GL_ES
precision highp float;
#else
#define lowp
#define mediump
#define highp
#endif

#ifndef MAPBOX_GL_JS
uniform mat4 u_matrix;
uniform float u_size;
#endif

attribute vec2 a_pos;

#ifndef MAPBOX_GL_JS
void main(void) {
    gl_Position = u_matrix * vec4(a_pos, 0, 1);
    gl_PointSize = u_size;
#else
uniform mat4 u_matrix;

void main() {
    gl_Position = u_matrix * vec4(a_pos, step(32767.0, a_pos.x), 1);
#endif
}
