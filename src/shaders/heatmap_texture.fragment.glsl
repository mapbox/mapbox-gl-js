uniform sampler2D u_image;
uniform sampler2D u_color_ramp;
uniform float u_opacity;
in vec2 v_pos;

void main() {
    float t = texture(u_image, v_pos).r;
    vec4 color = texture(u_color_ramp, vec2(t, 0.5));

    glFragColor = color * u_opacity;

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(0.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
