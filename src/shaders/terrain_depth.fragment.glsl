#ifdef GL_ES
precision highp float;
#endif

varying highp float v_depth;

void main() {
    gl_FragColor = pack_depth(v_depth);
}
