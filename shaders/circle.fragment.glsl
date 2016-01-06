precision mediump float;

uniform lowp float u_blur;

varying lowp vec4 v_color;
varying vec2 v_extrude;

void main() {
    float t = smoothstep(1.0 - u_blur, 1.0, length(v_extrude));
    gl_FragColor = v_color * (1.0 - t);
}
