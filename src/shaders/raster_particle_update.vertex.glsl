#include "_prelude_raster_array.glsl"
#include "_prelude_raster_particle.glsl"

in vec3 a_pos;

uniform float u_speed_factor;
uniform float u_lifetime_delta;
uniform float u_rand_seed;

out vec3 v_new_particle;

// pseudo-random generator
const vec3 rand_constants = vec3(12.9898, 78.233, 4375.85453);
float rand(const vec2 co) {
    float t = dot(rand_constants.xy, co);
    return fract(sin(t) * (rand_constants.z + t));
}

void main() {
    float lifetime = a_pos.z;

    vec2 pos = a_pos.xy;
    vec2 uv = clamp(pos, vec2(0.0), vec2(1.0));
    vec2 velocity = lookup_velocity(uv);

    float next_lifetime = lifetime - u_lifetime_delta;
    float t = step(0.0, next_lifetime);
#ifdef DATA_FORMAT_UINT32
    vec2 dp = vec2(0);
#else
    vec2 dp = velocity == INVALID_VELOCITY ? vec2(0) : velocity * u_speed_factor;
#endif
    vec2 seed = pos * u_rand_seed;

    vec2 next_pos = pos + dp;
    vec2 random_pos = vec2(rand(seed + 1.3), rand(seed + 2.1));
    v_new_particle = vec3(
        vec2(mix(random_pos, next_pos, t)),
        mix(1.0, next_lifetime, t)
    );
}
