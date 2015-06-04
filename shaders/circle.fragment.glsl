uniform vec4 u_color;
uniform float u_size;

varying vec4 v_centerpoint;

void main() {
    float dist = length(gl_FragCoord - v_centerpoint) / 100.0;
    float t = smoothstep(0.5 - (0.0 / 2.0), 0.5, dist);
    gl_FragColor = vec4(0, 0, t, 1);
    // gl_FragColor = mix(u_color, vec4(0.0, 0.0, 0.0, 0.0), t);
}
