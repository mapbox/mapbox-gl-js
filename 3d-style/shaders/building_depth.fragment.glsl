in highp float v_depth;

void main() {
#ifndef DEPTH_TEXTURE
    glFragColor = pack_depth(v_depth);
#endif
}
