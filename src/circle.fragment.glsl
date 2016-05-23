uniform vec4 u_color;
uniform float u_blur;
uniform float u_size;

varying vec2 v_extrude;

void main() {
    float t = smoothstep(1.0 - u_blur, 1.0, length(v_extrude));
    gl_FragColor = u_color * (1.0 - t);
}
