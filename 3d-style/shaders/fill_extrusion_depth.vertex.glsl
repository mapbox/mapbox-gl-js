#include "_prelude_terrain.vertex.glsl"

uniform mat4 u_matrix;
uniform float u_edge_radius;
uniform float u_width_scale;
uniform float u_vertical_scale;

#ifdef TERRAIN
uniform int u_height_type;
uniform int u_base_type;
#endif

in vec4 a_pos_normal_ed;
in vec2 a_centroid_pos;

#ifdef RENDER_WALL_MODE
in vec3 a_join_normal_inside;
#endif

#pragma mapbox: define highp float base
#pragma mapbox: define highp float height
#pragma mapbox: define highp float line_width
#pragma mapbox: define highp vec4 color

out highp float v_depth;

void main() {
    #pragma mapbox: initialize highp float base
    #pragma mapbox: initialize highp float height
    #pragma mapbox: initialize highp float line_width
    #pragma mapbox: initialize highp vec4 color

    base *= u_vertical_scale;
    height *= u_vertical_scale;

    vec3 pos_nx = floor(a_pos_normal_ed.xyz * 0.5);
    // The least significant bits of a_pos_normal_ed.xy hold:
    // x is 1 if it's on top, 0 for ground.
    // y is 1 if the normal points up, and 0 if it points to side.
    // z is sign of ny: 1 for positive, 0 for values <= 0.
    mediump vec3 top_up_ny = a_pos_normal_ed.xyz - 2.0 * pos_nx;

    base = max(0.0, base);
    height = max(0.0, top_up_ny.y == 0.0 && top_up_ny.x == 1.0 ? height - u_edge_radius : height);

    float t = top_up_ny.x;

    vec2 centroid_pos = vec2(0.0);
#if defined(HAS_CENTROID) || defined(TERRAIN)
    centroid_pos = a_centroid_pos;
#endif

vec3 pos;
#ifdef TERRAIN
    bool is_flat_height = centroid_pos.x != 0.0 && u_height_type == 1;
    bool is_flat_base = centroid_pos.x != 0.0 && u_base_type == 1;
    float ele = elevation(pos_nx.xy);
    float c_ele = is_flat_height || is_flat_base ? (centroid_pos.y == 0.0 ? elevationFromUint16(centroid_pos.x) : flatElevation(centroid_pos)) : ele;
    float h_height = is_flat_height ? max(c_ele + height, ele + base + 2.0) : ele + height;
    float h_base = is_flat_base ? max(c_ele + base, ele + base) : ele + (base == 0.0 ? -5.0 : base);
    float h = t > 0.0 ? max(h_base, h_height) : h_base;
    pos = vec3(pos_nx.xy, h);
#else
    pos = vec3(pos_nx.xy, t > 0.0 ? height : base);
#endif

#ifdef RENDER_WALL_MODE
    vec2 wall_offset = u_width_scale * line_width * (a_join_normal_inside.xy / EXTENT);
    pos.xy += (1.0 - a_join_normal_inside.z) * wall_offset * 0.5;
    pos.xy -= a_join_normal_inside.z * wall_offset * 0.5;
#endif
    float hidden = float((centroid_pos.x == 0.0 && centroid_pos.y == 1.0) || (color.a == 0.0));
    gl_Position = mix(u_matrix * vec4(pos, 1), AWAY, hidden);
    v_depth = gl_Position.z / gl_Position.w;
}
