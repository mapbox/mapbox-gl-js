uniform sampler2D u_sampler;
uniform vec4 u_color;
varying vec2 v_tex;

void main() {
    vec4 c = texture2D(u_sampler, v_tex);
    gl_FragColor = vec4(u_color.r, u_color.g, u_color.b, u_color.a * c.a);
}
