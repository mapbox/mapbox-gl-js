precision mediump float;

uniform sampler2D u_texture;
uniform vec4 u_color;
uniform float u_buffer;
uniform float u_gamma;

varying vec2 v_tex;

void main() {
    float dist = texture2D(u_texture, v_tex).a;
    float alpha = smoothstep(u_buffer - u_gamma, u_buffer + u_gamma, dist);
    gl_FragColor = u_color * alpha;
    // gl_FragColor = vec4(0, 0, 0, 1);
}
