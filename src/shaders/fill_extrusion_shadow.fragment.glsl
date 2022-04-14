#ifdef GL_ES
precision highp float;
#endif

vec4 pack_depth(float ndc_z) {
    float depth = ndc_z * 0.5 + 0.5;
    const vec4 bit_shift = vec4(256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0);
    const vec4 bit_mask  = vec4(0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);
    vec4 res = fract(depth * bit_shift);
    res -= res.xxyz * bit_mask;
    return res;
}

varying float v_depth;

void main() {
    gl_FragColor = pack_depth(gl_FragCoord.z);
}