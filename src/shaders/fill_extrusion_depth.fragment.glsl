varying highp float v_depth;

void main() {
    gl_FragColor = pack_depth(v_depth);
}
