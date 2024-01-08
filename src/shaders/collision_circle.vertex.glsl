in vec2 a_pos_2f;
in float a_radius;
in vec2 a_flags;

uniform mat4 u_matrix;
uniform mat4 u_inv_matrix;
uniform vec2 u_viewport_size;
uniform float u_camera_to_center_distance;

out float v_radius;
out vec2 v_extrude;
out float v_perspective_ratio;
out float v_collision;

vec3 toTilePosition(vec2 screenPos) {
    // Shoot a ray towards the ground to reconstruct the depth-value
    vec4 rayStart = u_inv_matrix * vec4(screenPos, -1.0, 1.0);
    vec4 rayEnd   = u_inv_matrix * vec4(screenPos,  1.0, 1.0);

    rayStart.xyz /= rayStart.w;
    rayEnd.xyz   /= rayEnd.w;

    highp float t = (0.0 - rayStart.z) / (rayEnd.z - rayStart.z);
    return mix(rayStart.xyz, rayEnd.xyz, t);
}

void main() {
    vec2 quadCenterPos = a_pos_2f;
    float radius = a_radius;
    float collision = a_flags.x;
    float vertexIdx = a_flags.y;

    vec2 quadVertexOffset = vec2(
        mix(-1.0, 1.0, float(vertexIdx >= 2.0)),
        mix(-1.0, 1.0, float(vertexIdx >= 1.0 && vertexIdx <= 2.0)));

    vec2 quadVertexExtent = quadVertexOffset * radius;

    // Screen position of the quad might have been computed with different camera parameters.
    // Transform the point to a proper position on the current viewport
    vec3 tilePos = toTilePosition(quadCenterPos);
    vec4 clipPos = u_matrix * vec4(tilePos, 1.0);

    highp float camera_to_anchor_distance = clipPos.w;
    highp float collision_perspective_ratio = clamp(
        0.5 + 0.5 * (u_camera_to_center_distance / camera_to_anchor_distance),
        0.0, // Prevents oversized near-field circles in pitched/overzoomed tiles
        4.0);

    // Apply small padding for the anti-aliasing effect to fit the quad
    // Note that v_radius and v_extrude are in screen coordinates already
    float padding_factor = 1.2;
    v_radius = radius;
    v_extrude = quadVertexExtent * padding_factor;
    v_perspective_ratio = collision_perspective_ratio;
    v_collision = collision;

    gl_Position = vec4(clipPos.xyz / clipPos.w, 1.0) + vec4(quadVertexExtent * padding_factor / u_viewport_size * 2.0, 0.0, 0.0);
}
