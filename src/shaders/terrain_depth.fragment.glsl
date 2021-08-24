#ifdef GL_ES
precision highp float;
#endif

varying float v_depth;

void main() {
    gl_FragColor = pack_depth(v_depth);
}
