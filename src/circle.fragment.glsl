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
#endif
varying lowp float v_antialiasblur;

varying vec2 v_extrude;

void main() {
#ifndef MAPBOX_GL_JS
    vec4 color = u_color;
#else
    #pragma mapbox: initialize color lowp
#endif

    float t = smoothstep(1.0 - max(u_blur, v_antialiasblur), 1.0, length(v_extrude));
    gl_FragColor = color * (1.0 - t) * u_opacity;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
