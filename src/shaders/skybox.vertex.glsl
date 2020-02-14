attribute vec3 a_pos;

uniform mat4 u_matrix;

varying vec3 v_uv;

const mat3 halfNegPIAroundX = mat3(1.0, 0.0, 0.0,
                                   0.0, 0.0,-1.0,
                                   0.0, 1.0, 0.0);

void main() {
    v_uv = halfNegPIAroundX * a_pos;
    vec4 pos = u_matrix * vec4(a_pos, 1.0);
    gl_Position = pos.xyww;
}
