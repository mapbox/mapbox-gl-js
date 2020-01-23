uniform sampler2D u_accum;
uniform sampler2D u_revealage;

varying vec2 v_pos;

void main() {
    float revealage = texture2D(u_revealage, v_pos).r;
    if (revealage == 1.0) {
        // Save the blending and color texture fetch cost
        discard;
    }
    vec4 accum = texture2D(u_accum, v_pos);
    gl_FragColor = vec4(accum.rgb / clamp(accum.a, 1e-2, 5e4), 1.0 - revealage);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(0.0);
#endif
}
