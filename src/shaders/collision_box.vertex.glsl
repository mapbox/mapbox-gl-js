attribute vec3 a_pos;
attribute vec2 a_anchor_pos;
attribute vec2 a_extrude;
attribute vec2 a_placed;
attribute vec2 a_shift;
attribute float a_size_scale;
attribute vec2 a_padding;

uniform mat4 u_matrix;
uniform vec2 u_extrude_scale;
uniform float u_camera_to_center_distance;

varying float v_placed;
varying float v_notUsed;

void main() {
    vec4 projectedPoint = u_matrix * vec4(a_pos + elevationVector(a_anchor_pos) * elevation(a_anchor_pos), 1);

    highp float camera_to_anchor_distance = projectedPoint.w;
    highp float collision_perspective_ratio = clamp(
        0.5 + 0.5 * (u_camera_to_center_distance / camera_to_anchor_distance),
        0.0, // Prevents oversized near-field boxes in pitched/overzoomed tiles
        1.5);

    gl_Position = projectedPoint;
    gl_Position.xy += (a_extrude * a_size_scale + a_shift + a_padding) * u_extrude_scale * gl_Position.w * collision_perspective_ratio;

    v_placed = a_placed.x;
    v_notUsed = a_placed.y;
}
