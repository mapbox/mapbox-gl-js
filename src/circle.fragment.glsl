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
uniform float u_size;
#else
uniform lowp float u_blur;
uniform lowp float u_opacity;
#endif

varying vec2 v_extrude;
#ifdef MAPBOX_GL_JS
varying lowp float v_antialiasblur;

#pragma mapbox: define color lowp
#endif

void main() {
#ifndef MAPBOX_GL_JS
    float t = smoothstep(1.0 - u_blur, 1.0, length(v_extrude));
    gl_FragColor = u_color * (1.0 - t);
#else
    #pragma mapbox: initialize color

    float t = smoothstep(1.0 - max(u_blur, v_antialiasblur), 1.0, length(v_extrude));
    gl_FragColor = color * (1.0 - t) * u_opacity;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
#endif
}
