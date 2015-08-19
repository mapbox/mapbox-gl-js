uniform sampler2D u_image;

varying vec2 v_pos;

void main() {
    vec4 color = texture2D(u_image, v_pos) + vec4(0.0, 1.0, 0.0, 0.0);
    gl_FragColor = color;
}
