varying highp float v_depth;

void main() {
#ifndef DEPTH_TEXTURE
    gl_FragColor = pack_depth(v_depth);
#endif
}
