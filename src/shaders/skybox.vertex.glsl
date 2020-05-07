attribute highp vec3 a_pos;

uniform lowp mat4 u_matrix;

varying lowp vec3 v_uv;
varying highp vec3 v_sun_direction;

float map(float value, float start, float end, float new_start, float new_end) {
    return ((value - start) * (new_end - new_start)) / (end - start) + new_start;
}

void main() {
    const mat3 half_neg_pi_around_x = mat3(1.0, 0.0,  0.0,
                                           0.0, 0.0, -1.0,
                                           0.0, 1.0,  0.0);

    v_sun_direction = half_neg_pi_around_x * a_pos;
    v_uv = v_sun_direction;

    // To make better utilization of the visible range (e.g. over the horizon, UVs
    // from 0.0 to 1.0 on the Y-axis in cubemap space), the UV range is remapped from
    // (0.0,1.0) to (-1.0,1.0) on y. The inverse operation is applied when generating.
    v_uv.y = map(v_uv.y, 0.0, 1.0, -1.0, 1.0);

    vec4 pos = u_matrix * vec4(a_pos, 1.0);

    // Enforce depth to be 1.0
    gl_Position = pos.xyww;
}
