#ifdef GL_ES
precision mediump float;
#else
#define lowp
#define mediump
#define highp
#endif

uniform lowp float u_blur;
uniform lowp float u_opacity;

#ifndef MAPBOX_GL_JS
uniform vec4 u_color;
#else
#pragma mapbox: define color lowp
varying lowp float v_antialiasblur;
#endif

varying vec2 v_extrude;

void main() {
#ifndef MAPBOX_GL_JS
    float t = smoothstep(1.0 - u_blur, 1.0, length(v_extrude));
    gl_FragColor = u_color * (1.0 - t) * u_opacity;
#else
    #pragma mapbox: initialize color lowp

    float t = smoothstep(1.0 - max(u_blur, v_antialiasblur), 1.0, length(v_extrude));
    gl_FragColor = color * (1.0 - t) * u_opacity;
#endif

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
