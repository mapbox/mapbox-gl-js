#ifdef GL_ES
precision highp float;
#else
#define lowp
#define mediump
#define highp
#endif

attribute vec2 a_pos;

uniform mat4 u_matrix;

#ifdef MAPBOX_GL_JS
#pragma mapbox: define color lowp
#endif

void main() {

#ifdef MAPBOX_GL_JS
    #pragma mapbox: initialize color lowp
#endif

    gl_Position = u_matrix * vec4(a_pos, 0, 1);
}
