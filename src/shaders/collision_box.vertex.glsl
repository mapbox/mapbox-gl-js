#include "_prelude_terrain.vertex.glsl"

in vec3 a_pos;
in vec2 a_anchor_pos;
in vec2 a_extrude;
in vec2 a_placed;
in vec2 a_shift;
in vec2 a_elevation_from_sea;
in float a_size_scale;
in vec2 a_padding;
in float a_auto_z_offset;

uniform mat4 u_matrix;
uniform vec2 u_extrude_scale;
uniform float u_camera_to_center_distance;

#ifdef PROJECTION_GLOBE_VIEW
uniform vec3 u_tile_id;
uniform mat4 u_inv_rot_matrix;
uniform vec2 u_merc_center;
uniform float u_zoom_transition;
#endif

out float v_placed;
out float v_notUsed;

void main() {
    float feature_elevation = a_elevation_from_sea.x + a_auto_z_offset;
    float terrain_elevation = (a_elevation_from_sea.y == 1.0 ? 0.0 : elevation(a_anchor_pos));
    vec3 proj_pos = a_pos + elevationVector(a_anchor_pos) * (feature_elevation + terrain_elevation);
#ifdef PROJECTION_GLOBE_VIEW
#ifndef PROJECTED_POS_ON_VIEWPORT
    vec3 globe_pos = proj_pos;
    vec3 mercator_pos = mercator_tile_position(u_inv_rot_matrix, a_anchor_pos, u_tile_id, u_merc_center);
    proj_pos = mix_globe_mercator(globe_pos, mercator_pos, u_zoom_transition);
#endif
#endif
    vec4 projectedPoint = u_matrix * vec4(proj_pos, 1);

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
