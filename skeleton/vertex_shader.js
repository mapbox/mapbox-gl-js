const vertexShader = `

attribute vec4 a_pos;

varying float v_distance;

void main(void) {
    gl_Position = vec4(((a_pos.xy + 100.0) / 500.0 * vec2(1.0, -1.0)) + vec2(-1.0, 1.0), 0.0, 1.0);
    v_distance = a_pos[2];
}
`;
