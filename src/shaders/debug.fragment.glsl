uniform highp vec4 u_color;
uniform sampler2D u_overlay;

varying vec2 v_uv;

void main() {
    vec4 overlay_color = texture2D(u_overlay, v_uv);
    gl_FragColor = mix(u_color, overlay_color, overlay_color.a);
}
