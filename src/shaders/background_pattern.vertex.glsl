#include "_prelude_fog.vertex.glsl"

uniform mat4 u_matrix;
uniform vec2 u_pattern_size;
uniform vec2 u_pixel_coord_upper;
uniform vec2 u_pixel_coord_lower;
uniform vec2 u_pattern_units_to_pixels;

in ivec2 a_pos;

out highp vec2 v_pos;

void main() {
    vec2 pos = vec2(a_pos);
    gl_Position = u_matrix * vec4(pos, 0, 1);

    v_pos = get_pattern_pos(u_pixel_coord_upper, u_pixel_coord_lower, u_pattern_size, u_pattern_units_to_pixels, pos);

#ifdef FOG
    v_fog_pos = fog_position(pos);
#endif
}
