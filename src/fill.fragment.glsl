#ifdef GL_ES
precision mediump float;
#else
#define lowp
#define mediump
#define highp
#endif

#ifdef MAPBOX_GL_JS
#pragma mapbox: define color lowp
#else
uniform lowp vec4 u_color;
#endif

uniform lowp float u_opacity;

void main() {

#ifdef MAPBOX_GL_JS
    #pragma mapbox: initialize color lowp
#else
    lowp vec4 color = u_color;
#endif

    gl_FragColor = color * u_opacity;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
