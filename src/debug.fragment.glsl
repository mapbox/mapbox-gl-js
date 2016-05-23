#ifdef GL_ES
precision mediump float;
#else
#define lowp
#define mediump
#define highp
#endif

#ifndef MAPBOX_GL_JS
uniform vec4 u_color;
uniform float u_blur;
#endif

#ifndef MAPBOX_GL_JS
void main() {
    float dist = length(gl_PointCoord - 0.5);
    float t = smoothstep(0.5, 0.5 - u_blur, dist);
#else
uniform lowp vec4 u_color;
#endif

#ifndef MAPBOX_GL_JS
    gl_FragColor = u_color * t;
#else
void main() {
    gl_FragColor = u_color;
#endif
}
