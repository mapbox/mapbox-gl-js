uniform mat4 u_matrix;
uniform vec2 u_pattern_size;
uniform vec2 u_pixel_coord_upper;
uniform vec2 u_pixel_coord_lower;
uniform float u_tile_units_to_pixels;

attribute vec2 a_pos;

varying vec2 v_pos;

void main() {
    gl_Position = u_matrix * vec4(a_pos, 0, 1);

    v_pos = get_pattern_pos(u_pixel_coord_upper, u_pixel_coord_lower, u_pattern_size, u_tile_units_to_pixels, a_pos);

#ifdef FOG
    v_fog_pos = fog_position(a_pos);
#endif
}
