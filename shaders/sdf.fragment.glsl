precision mediump float;

uniform sampler2D u_texture;
uniform lowp vec4 u_color;
uniform lowp float u_buffer;
uniform lowp float u_gamma;

varying vec2 v_tex;
varying float v_alpha;
varying float v_gamma_scale;

void main() {
    lowp float gamma = u_gamma * v_gamma_scale;
    lowp float dist = texture2D(u_texture, v_tex).a;
    lowp float alpha = smoothstep(u_buffer - gamma, u_buffer + gamma, dist) * v_alpha;
    gl_FragColor = u_color * alpha;
}
