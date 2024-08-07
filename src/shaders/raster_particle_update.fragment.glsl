#include "_prelude_raster_particle.glsl"

uniform sampler2D u_particle_texture;
uniform mediump float u_particle_texture_side_len;
uniform mediump float u_speed_factor;
uniform highp float u_reset_rate;
uniform highp float u_rand_seed;

in highp vec2 v_tex_coord;

vec2 linearstep(vec2 edge0, vec2 edge1, vec2 x) {
    return  clamp((x - edge0) / (edge1 - edge0), vec2(0), vec2(1));
}

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

    // An ad hoc mask that's 1 inside the tile and ramps to zero outside the
    // boundary. The constant power of 4 is tuned to cause particles to traverse
    // roughly the width of the boundary before dropping.
    highp vec2 persist_rate = pow(
      linearstep(vec2(-u_particle_pos_offset), vec2(0), pos) *
      linearstep(vec2(1.0 + u_particle_pos_offset), vec2(1), pos),
      vec2(4)
    );

    // Raise the persist rate to the inverse power of the number of steps
    // taken to traverse the boundary. This yields a per-frame persist
    // rate which gives the overall chance of dropping by the time it
    // traverses the entire boundary buffer.
    highp vec2 per_frame_persist = pow(persist_rate, abs(dp) / u_particle_pos_offset);

    // Combine drop probability wrt x-boundary and y-boundary into a single drop rate
    highp float drop_rate = 1.0 - per_frame_persist.x * per_frame_persist.y;

    // Apply a hard drop cutoff outside the boundary of what we encode
    drop_rate = any(greaterThanEqual(abs(pos - 0.5), vec2(0.5 + u_particle_pos_offset))) ? 1.0 : drop_rate;

    highp float drop = step(1.0 - drop_rate - u_reset_rate, rand(seed));
    highp vec2 next_pos = mix(pos, random_pos, drop);

    glFragColor = pack_pos_to_rgba(next_pos);
}
