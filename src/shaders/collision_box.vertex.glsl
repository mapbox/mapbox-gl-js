attribute vec2 a_pos;
attribute vec2 a_anchor_pos;
attribute vec2 a_extrude;
attribute float a_placed;

uniform mat4 u_matrix;
uniform vec2 u_extrude_scale;
uniform float u_camera_to_center_distance;

varying float v_placed;

void main() {
    vec4 projectedPoint = u_matrix * vec4(a_anchor_pos, 0, 1);
    highp float camera_to_anchor_distance = projectedPoint.w;
    highp float collision_perspective_ratio = 1.0 + 0.5 * ((camera_to_anchor_distance / u_camera_to_center_distance) - 1.0);

    gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
    gl_Position.xy += a_extrude * u_extrude_scale * gl_Position.w / collision_perspective_ratio;

    v_placed = a_placed;
}
