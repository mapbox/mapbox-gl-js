#include "_prelude_raster_particle.glsl"

uniform sampler2D u_particle_texture;
uniform float u_particle_texture_side_len;
uniform float u_speed_factor;
uniform float u_reset_rate;
uniform float u_rand_seed;

in vec2 v_tex_coord;

// pseudo-random generator
const vec3 rand_constants = vec3(12.9898, 78.233, 4375.85453);
float rand(const vec2 co) {
    float t = dot(rand_constants.xy, co);
    return fract(sin(t) * (rand_constants.z + t));
}

void main() {
    ivec2 pixel_coord = ivec2(v_tex_coord * u_particle_texture_side_len);
    vec4 pixel = texelFetch(u_particle_texture, pixel_coord, 0);
    vec2 pos = decode_pos(pixel);
    vec2 velocity = lookup_velocity(clamp(pos, 0.0, 1.0));
    vec2 dp;
#ifdef DATA_FORMAT_UINT32
    dp = vec2(0);
#else
    dp = velocity == INVALID_VELOCITY ? vec2(0) : velocity * u_speed_factor;
#endif
    pos = pos + dp;

    vec2 seed = (pos + v_tex_coord) * u_rand_seed;
    vec2 random_pos = vec2(rand(seed + 1.3), rand(seed + 2.1));
    float speed = velocity == INVALID_VELOCITY ? 0.0 : length(velocity);
    float reset_rate_bump = speed * u_reset_rate;
    vec2 particle_pos_min = -u_particle_pos_offset;
    vec2 particle_pos_max = vec2(1.0) + u_particle_pos_offset;    
    // drop rate 0: (min pos) < x < (max pos), else drop rate 1
    vec2 pos_drop_rate = vec2(1.0) - step(particle_pos_min, pos) + step(particle_pos_max, pos);
    float drop_rate = max(u_reset_rate + reset_rate_bump, length(pos_drop_rate));
    float drop = step(1.0 - drop_rate, rand(seed));
    vec2 next_pos = mix(pos, random_pos, drop);

    glFragColor = encode_pos(next_pos);
}
