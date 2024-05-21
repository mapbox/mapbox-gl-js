#include "_prelude_raster_particle.glsl"

in float a_index;

uniform sampler2D u_particle_texture;
uniform float u_particle_texture_side_len;
uniform vec2 u_tile_offset;

out float v_particle_speed;

void main() {
    ivec2 pixel_coord = ivec2(
        mod(a_index, u_particle_texture_side_len),
        a_index / u_particle_texture_side_len);
    vec4 pixel = texelFetch(u_particle_texture, pixel_coord, 0);
    vec2 pos = unpack_pos_from_rgba(pixel) + u_tile_offset;

    vec2 tex_coord = fract(pos);
    vec2 velocity = lookup_velocity(tex_coord);
    if (velocity == INVALID_VELOCITY) {
        gl_Position = AWAY;
        v_particle_speed = 0.0;
    } else {
        gl_Position = vec4(2.0 * pos - vec2(1.0), 0.0, 1.0);
        v_particle_speed = length(velocity);
    }
    gl_PointSize = 1.0;
}
