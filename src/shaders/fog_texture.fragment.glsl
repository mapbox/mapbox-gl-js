uniform sampler2D u_image;
varying vec2 v_pos;

void main() {
    float fog_depth = texture2D(u_image, v_pos).r;

    gl_FragColor = vec4(u_fog_color * fog_depth, fog_depth);
#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(0.0);
#endif
}
