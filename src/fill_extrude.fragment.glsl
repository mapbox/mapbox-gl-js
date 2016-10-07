#ifdef GL_ES
precision mediump float;
#else
#define lowp
#define mediump
#define highp
#endif

varying vec4 v_color;
#ifdef MAPBOX_GL_JS
#pragma mapbox: define lowp float minH
#pragma mapbox: define lowp float maxH
#endif
#pragma mapbox: define lowp vec4 color

void main() {
#ifdef MAPBOX_GL_JS
    #pragma mapbox: initialize lowp float minH
    #pragma mapbox: initialize lowp float maxH
#endif
    #pragma mapbox: initialize lowp vec4 color

    gl_FragColor = v_color;
}
