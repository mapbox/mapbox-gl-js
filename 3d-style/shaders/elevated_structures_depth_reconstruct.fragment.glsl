#ifdef DEPTH_RECONSTRUCTION
in float v_height;
#endif

void main() {
#ifdef DEPTH_RECONSTRUCTION
    if (v_height >= 0.0)
        discard;
#endif

    glFragColor = vec4(1.0, 0.0, 0.0, 1.0);
}