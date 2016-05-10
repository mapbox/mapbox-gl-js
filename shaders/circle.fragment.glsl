precision mediump float;

uniform lowp float u_blur;
uniform lowp float u_opacity;

varying vec2 v_extrude;
varying lowp float v_antialiasblur;

#pragma mapbox: define(color)

void main() {
    #pragma mapbox: initialize(color)

    float t = smoothstep(1.0 - max(u_blur, v_antialiasblur), 1.0, length(v_extrude));
    gl_FragColor = color * (1.0 - t) * u_opacity;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
