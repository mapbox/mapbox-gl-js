precision mediump float;

uniform sampler2D u_image0;
uniform sampler2D u_image1;

varying vec2 v_pos;

void main() {
    vec4 color0 = texture2D(u_image0, v_pos);
    vec4 color1 = texture2D(u_image1, v_pos);
    gl_FragColor = mix(color0, color1, 0.5);
}
