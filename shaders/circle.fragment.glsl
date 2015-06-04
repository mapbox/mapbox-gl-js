uniform vec4 u_color;
uniform float u_blur;
uniform float u_size;

varying vec2 v_extrude;

void main() {
    float t = smoothstep(0.5 - (u_blur / 2.0), 0.5, length(v_extrude));
    gl_FragColor = u_color * (1.0 - t);
}
