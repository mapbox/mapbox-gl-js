#ifdef RASTER_ARRAY
uniform sampler2D u_velocity;
uniform vec2 u_velocity_res;
uniform float u_max_speed;

const vec2 INVALID_VELOCITY = vec2(-1);

uniform vec2 u_texture_offset;
uniform float u_data_offset;
uniform vec4 u_data_scale;

vec2 lookup_velocity(vec2 uv) {
    uv = u_texture_offset.x + u_texture_offset.y * uv;
    vec2 fxy;
    ivec4 c = _raTexLinearCoord(uv, u_velocity_res, fxy);
    vec4 tl = texelFetch(u_velocity, c.yz, 0);
    vec4 tr = texelFetch(u_velocity, c.xz, 0);
    vec4 bl = texelFetch(u_velocity, c.yw, 0);
    vec4 br = texelFetch(u_velocity, c.xw, 0);

    if (tl == NODATA) {
        return INVALID_VELOCITY;
    }
    if (tr == NODATA) {
        return INVALID_VELOCITY;
    }
    if (bl == NODATA) {
        return INVALID_VELOCITY;
    }
    if (br == NODATA) {
        return INVALID_VELOCITY;
    }

    vec4 t = mix(mix(bl, br, fxy.x), mix(tl, tr, fxy.x), fxy.y);

#ifdef DATA_FORMAT_UINT32
    vec2 velocity = vec2(u_data_offset + dot(t, u_data_scale), 0);
    return velocity;
#else
    vec2 velocity = vec2(u_data_offset + dot(t.rg, u_data_scale.yx), -(u_data_offset + dot(t.ba, u_data_scale.yx)));
#endif
    return velocity / max(u_max_speed, length(velocity));
}
#endif
