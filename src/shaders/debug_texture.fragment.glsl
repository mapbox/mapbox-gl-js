uniform sampler2D u_image;
varying vec2 v_pos;

void main() {
    gl_FragColor = texture2D(u_image, v_pos);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(0.0);
#endif
}
