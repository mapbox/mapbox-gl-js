attribute highp vec3 a_pos;

uniform mat3 u_matrix;

varying highp vec3 v_position;

float map(float value, float start, float end, float new_start, float new_end) {
    return ((value - start) * (new_end - new_start)) / (end - start) + new_start;
}

void main() {
    vec4 pos = vec4(u_matrix * a_pos, 1.0);

    v_position = pos.xyz;
    v_position.y *= -1.0;

    // To make better utilization of the visible range (e.g. over the horizon, UVs
    // from 0.0 to 1.0 on the Y-axis in cubemap space), the UV range is remapped from
    // (-1.0,1.0) to (0.0,1.0) on y. The inverse operation is applied when sampling.
    v_position.y = map(v_position.y, -1.0, 1.0, 0.0, 1.0);

    // Add a small offset to prevent black bands around areas where
    // the scattering algorithm does not manage to gather lighting
    const float y_bias = 0.015;
    v_position.y += y_bias;

    gl_Position = vec4(a_pos.xy, 0.0, 1.0);
}
