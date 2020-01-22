varying vec4 v_color;

void main() {
    float w = clamp(pow(min(1.0, v_color.a * 10.0) + 0.01, 3.0) * 1e8 * pow(1.0 - gl_FragCoord.z * 0.9, 3.0), 1e-2, 3e3);

    gl_FragColor = vec4(v_color.r * v_color.a, v_color.g * v_color.a, v_color.b * v_color.a, v_color.a ) * w;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
