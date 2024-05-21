#include "_prelude_raster_particle.glsl"

uniform sampler2D u_particle_texture;
uniform mediump float u_particle_texture_side_len;
uniform mediump float u_speed_factor;
uniform highp float u_reset_rate;
uniform highp float u_rand_seed;

in highp vec2 v_tex_coord;

// pseudo-random generator
const highp vec3 rand_constants = vec3(12.9898, 78.233, 4375.85453);
highp float rand(const highp vec2 co) {
    highp float t = dot(rand_constants.xy, co);
    return fract(sin(t) * (rand_constants.z + t));
}

void main() {
    ivec2 pixel_coord = ivec2(v_tex_coord * u_particle_texture_side_len);
    highp vec4 pixel = texelFetch(u_particle_texture, pixel_coord, 0);
    highp vec2 pos = unpack_pos_from_rgba(pixel);
    highp vec2 velocity = lookup_velocity(clamp(pos, 0.0, 1.0));
    highp vec2 dp = velocity == INVALID_VELOCITY ? vec2(0) : velocity * u_speed_factor;
    pos = pos + dp;

    highp vec2 seed = (pos + v_tex_coord) * u_rand_seed;
    highp vec2 random_pos = vec2(rand(seed + 1.3), rand(seed + 2.1));
    highp float speed = velocity == INVALID_VELOCITY ? 0.0 : length(velocity);
    highp float reset_rate_bump = speed * u_reset_rate;
    highp vec2 particle_pos_min = -u_particle_pos_offset;
    highp vec2 particle_pos_max = vec2(1.0) + u_particle_pos_offset;    
    // drop rate 0: (min pos) < x < (max pos), else drop rate 1
    highp vec2 pos_drop_rate = vec2(1.0) - step(particle_pos_min, pos) + step(particle_pos_max, pos);
    highp float drop_rate = max(u_reset_rate + reset_rate_bump, length(pos_drop_rate));
    highp float drop = step(1.0 - drop_rate, rand(seed));
    highp vec2 next_pos = mix(pos, random_pos, drop);

    glFragColor = pack_pos_to_rgba(next_pos);
}
