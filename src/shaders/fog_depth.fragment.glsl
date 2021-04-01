#ifdef GL_ES
precision highp float;
#endif

varying vec3 v_fog_pos;

void main() {
    gl_FragColor = vec4(fog_opacity(v_fog_pos), 1.0, 1.0, 1.0);
}
