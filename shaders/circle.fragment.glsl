precision mediump float;

uniform lowp float u_blur;
uniform lowp float u_opacity;

varying lowp vec4 v_color;
varying vec2 v_extrude;
varying lowp float v_antialiasblur;

void main() {
    float t = smoothstep(1.0 - max(u_blur, v_antialiasblur), 1.0, length(v_extrude));
    gl_FragColor = v_color * (1.0 - t) * u_opacity;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
