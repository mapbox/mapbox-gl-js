#ifdef GL_ES
precision mediump float;
#else
#define lowp
#define mediump
#define highp
#endif

#ifndef MAPBOX_GL_JS
uniform vec4 u_color;
#else
uniform lowp vec4 u_color;
uniform lowp float u_opacity;
#endif

void main() {
#ifndef MAPBOX_GL_JS
    gl_FragColor = u_color;
#else
    gl_FragColor = u_color * u_opacity;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
#endif
}
