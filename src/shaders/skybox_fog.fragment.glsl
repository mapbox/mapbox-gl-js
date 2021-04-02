varying highp vec3 v_uv;

void main() {
    gl_FragColor = vec4(fog_sky_opacity(v_uv), 1.0, 1.0, 1.0);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
