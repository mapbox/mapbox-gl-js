#ifdef GL_ES
precision highp float;
#else
#define lowp
#define mediump
#define highp
#endif

attribute vec2 a_pos;

uniform mat4 u_matrix;

void main() {
    gl_Position = u_matrix * vec4(a_pos, step(32767.0, a_pos.x), 1);
}
