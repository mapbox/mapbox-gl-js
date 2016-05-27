#ifdef GL_ES
precision highp float;
#else
#define lowp
#define mediump
#define highp
#endif

attribute vec2 a_pos;

uniform mat4 u_matrix;
uniform vec2 u_world;

varying vec2 v_pos;

#ifdef MAPBOX_GL_JS
#pragma mapbox: define outline_color lowp
#endif


void main() {
#ifdef MAPBOX_GL_JS
    #pragma mapbox: initialize outline_color lowp
#endif

    gl_Position = u_matrix * vec4(a_pos, 0, 1);
    v_pos = (gl_Position.xy / gl_Position.w + 1.0) / 2.0 * u_world;
}
