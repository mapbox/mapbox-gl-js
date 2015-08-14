uniform sampler2D u_texture;
uniform vec4 u_color;
uniform float u_buffer;
uniform float u_gamma;

varying vec2 v_tex;
varying float v_alpha;
varying float v_gamma_scale;

void main() {
    float dist = texture2D(u_texture, v_tex).a;
    float gamma = u_gamma * v_gamma_scale;
    float alpha = smoothstep(u_buffer - gamma, u_buffer + gamma, dist) * v_alpha;
    gl_FragColor = u_color * alpha;
}
