#ifdef GL_ES
precision mediump float;
#else
#define lowp
#define mediump
#define highp
#endif

#pragma mapbox: define lowp vec4 color
#pragma mapbox: define lowp float blur
#pragma mapbox: define lowp float opacity

varying vec2 v_extrude;
varying lowp float v_antialiasblur;

void main() {
    #pragma mapbox: initialize lowp vec4 color
    #pragma mapbox: initialize lowp float blur
    #pragma mapbox: initialize lowp float opacity

    float t = smoothstep(1.0 - max(blur, v_antialiasblur), 1.0, length(v_extrude));
    gl_FragColor = color * (1.0 - t) * opacity;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
