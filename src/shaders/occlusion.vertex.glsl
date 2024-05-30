#include "_prelude_terrain.vertex.glsl"

in highp vec2 a_offset_xy;

uniform highp vec3 u_anchorPos;

uniform mat4 u_matrix;
uniform vec2 u_screenSizePx;
uniform vec2 u_occluderSizePx;

void main() {
    vec3 world_pos = u_anchorPos;

#ifdef TERRAIN
    float e = elevation(world_pos.xy);
    world_pos.z += e;
#endif

    vec4 projected_point = u_matrix * vec4(world_pos, 1.0);

    projected_point.xy += projected_point.w * a_offset_xy * 0.5 * u_occluderSizePx / u_screenSizePx;

    gl_Position = projected_point;
}
