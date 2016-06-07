#ifdef GL_ES
precision highp float;
#else
#define lowp
#define mediump
#define highp
#endif

attribute vec2 a_pos;

uniform mat4 u_matrix;

#pragma mapbox: define lowp vec4 color

void main() {
    #pragma mapbox: initialize lowp vec4 color

    gl_Position = u_matrix * vec4(a_pos, 0, 1);
}
