uniform sampler2D u_texture;

varying vec2 v_tex;
varying float v_alpha;
varying float v_gamma_scale;
varying vec4 v_color;
varying float v_buffer;
varying float v_gamma;

void main() {
    float gamma = v_gamma * v_gamma_scale;
    float dist = texture2D(u_texture, v_tex).a;
    float alpha = smoothstep(v_buffer - gamma, v_buffer + gamma, dist) * v_alpha;
    gl_FragColor = v_color * alpha;
}
