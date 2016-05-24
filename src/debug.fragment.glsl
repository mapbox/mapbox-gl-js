#ifdef GL_ES
precision mediump float;
#else
#define lowp
#define mediump
#define highp
#endif

uniform lowp vec4 u_color;

void main() {
    gl_FragColor = u_color;
}
