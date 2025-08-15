#ifdef DEPTH_RECONSTRUCTION
in float v_height;
#endif

void main() {
#ifdef DEPTH_RECONSTRUCTION
    if (v_height >= 0.0)
        discard;
#else
#ifdef FEATURE_CUTOUT
    apply_feature_cutout(vec4(0.0, 0.0, 0.0, 1.0), gl_FragCoord);
#endif
#endif
    glFragColor = vec4(1.0, 0.0, 0.0, 1.0);
}