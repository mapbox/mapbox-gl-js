attribute highp vec3 a_pos;

uniform lowp mat4 u_matrix;

varying highp vec3 v_uv;

void main() {
    const mat3 half_neg_pi_around_x = mat3(1.0, 0.0,  0.0,
                                           0.0, 0.0, -1.0,
                                           0.0, 1.0,  0.0);

    v_uv = half_neg_pi_around_x * a_pos;
    vec4 pos = u_matrix * vec4(a_pos, 1.0);

    // Enforce depth to be 1.0
    gl_Position = pos.xyww;
}
