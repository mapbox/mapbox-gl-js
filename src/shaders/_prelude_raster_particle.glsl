#ifdef RASTER_ARRAY
uniform sampler2D u_velocity;
uniform vec2 u_velocity_res;
uniform float u_max_speed;

const vec4 NO_DATA = vec4(1);
const vec2 INVALID_VELOCITY = vec2(-1);

uniform vec2 u_uv_offset;
uniform float u_data_offset;
uniform vec4 u_data_scale;

ivec4 rasterArrayLinearCoord(highp vec2 texCoord, highp vec2 texResolution, out highp vec2 fxy) {
    texCoord = texCoord * texResolution - 0.5;
    fxy = fract(texCoord);
    texCoord -= fxy;
    return ivec4(texCoord.xxyy + vec2(1.5, 0.5).xyxy);
}

vec2 lookup_velocity(vec2 uv) {
    uv = u_uv_offset.x + u_uv_offset.y * uv;
    vec2 fxy;
    ivec4 c = rasterArrayLinearCoord(uv, u_velocity_res, fxy);
    vec4 tl = texelFetch(u_velocity, c.yz, 0);
    vec4 tr = texelFetch(u_velocity, c.xz, 0);
    vec4 bl = texelFetch(u_velocity, c.yw, 0);
    vec4 br = texelFetch(u_velocity, c.xw, 0);

    if (tl == NO_DATA) {
        return INVALID_VELOCITY;
    }
    if (tr == NO_DATA) {
        return INVALID_VELOCITY;
    }
    if (bl == NO_DATA) {
        return INVALID_VELOCITY;
    }
    if (br == NO_DATA) {
        return INVALID_VELOCITY;
    }

    vec4 t = mix(mix(bl, br, fxy.x), mix(tl, tr, fxy.x), fxy.y);

    vec2 velocity;
#ifdef DATA_FORMAT_UINT32
    velocity = vec2(u_data_offset + dot(t, u_data_scale), 0);
#else
    velocity = vec2(u_data_offset + dot(t.rg, u_data_scale.yx), -(u_data_offset + dot(t.ba, u_data_scale.yx)));
    velocity /= max(u_max_speed, length(velocity));
#endif
    return velocity;
}
#endif

uniform highp float u_particle_pos_scale;
uniform highp vec2 u_particle_pos_offset;

vec2 decode_pos(vec4 pixel) {
    highp vec2 p = vec2(
        pixel.r / 255.0 + pixel.b,
        pixel.g / 255.0 + pixel.a);

    return u_particle_pos_scale * p - u_particle_pos_offset;
}

vec4 encode_pos(vec2 pos) {
    highp vec2 p = (pos + u_particle_pos_offset) / u_particle_pos_scale;
    return vec4(
        fract(p * 255.0),
        floor(p * 255.0) / 255.0);
}
