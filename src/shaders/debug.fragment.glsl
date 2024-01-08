uniform highp vec4 u_color;
uniform sampler2D u_overlay;

in vec2 v_uv;

void main() {
    vec4 overlay_color = texture(u_overlay, v_uv);
    glFragColor = mix(u_color, overlay_color, overlay_color.a);
}
