attribute highp vec3 a_pos;

uniform lowp mat4 u_matrix;

varying lowp vec3 v_uv;
varying highp vec3 v_sun_direction;

void main() {
    const mat3 half_neg_pi_around_x = mat3(1.0, 0.0,  0.0,
                                           0.0, 0.0, -1.0,
                                           0.0, 1.0,  0.0);

    v_sun_direction = half_neg_pi_around_x * a_pos;
    v_uv = v_sun_direction;

    vec4 pos = u_matrix * vec4(a_pos, 1.0);

    // Enforce depth to be 1.0
    gl_Position = pos.xyww;
}
