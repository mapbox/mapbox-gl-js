precision highp float;

in float v_depth;

void main() {
    glFragColor = pack_depth(v_depth);
}
