precision mediump float;

uniform lowp vec4 u_color;
uniform lowp float u_opacity;

void main() {
    gl_FragColor = u_color * u_opacity;
}
