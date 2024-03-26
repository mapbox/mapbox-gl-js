precision highp float;

#include "_prelude_raster_array.glsl"
#include "_prelude_raster_particle.glsl"

in vec3 a_pos;

uniform vec2 u_tile_offset;

out float v_particle_speed;

void main() {
    vec2 pos = a_pos.xy + u_tile_offset;
    vec2 tex_coords = fract(pos);
    gl_PointSize = 1.0;
    vec2 velocity = lookup_velocity(tex_coords);
    if (velocity == INVALID_VELOCITY) {
        v_particle_speed = 0.0;
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    } else {
        v_particle_speed = length(velocity);
        gl_Position = vec4(2.0 * pos - vec2(1.0), 0.0, 1.0);
    }
}
