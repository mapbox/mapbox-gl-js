uniform sampler2D u_image0;
varying vec2 v_pos0;

void main() {
    gl_FragColor = texture2D(u_image0, v_pos0);
#ifdef TERRAIN_WIREFRAME
    gl_FragColor = vec4(1.0, 0.0, 0.0, 0.8);
#endif
#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
