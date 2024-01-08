in float v_radius;
in vec2 v_extrude;
in float v_perspective_ratio;
in float v_collision;

void main() {
    float alpha = 0.5 * min(v_perspective_ratio, 1.0);
    float stroke_radius = 0.9 * max(v_perspective_ratio, 1.0);

    float distance_to_center = length(v_extrude);
    float distance_to_edge = abs(distance_to_center - v_radius);
    float opacity_t = smoothstep(-stroke_radius, 0.0, -distance_to_edge);

    vec4 color = mix(vec4(0.0, 0.0, 1.0, 0.5), vec4(1.0, 0.0, 0.0, 1.0), v_collision);

    glFragColor = color * alpha * opacity_t;
}
