#ifdef RASTER_ARRAY
uniform sampler2D u_velocity;
uniform mediump vec2 u_velocity_res;
uniform mediump float u_max_speed;

const vec4 NO_DATA = vec4(1);
const vec2 INVALID_VELOCITY = vec2(-1);

uniform highp vec2 u_uv_offset;
uniform highp float u_data_offset;
uniform highp vec4 u_data_scale;

ivec4 rasterArrayLinearCoord(highp vec2 texCoord, highp vec2 texResolution, out highp vec2 fxy) {
    texCoord = texCoord * texResolution - 0.5;
    fxy = fract(texCoord);
    texCoord -= fxy;
    return ivec4(texCoord.xxyy + vec2(1.5, 0.5).xyxy);
}

highp vec2 lookup_velocity(highp vec2 uv) {
    uv = u_uv_offset.x + u_uv_offset.y * uv;
    highp vec2 fxy;
    ivec4 c = rasterArrayLinearCoord(uv, u_velocity_res, fxy);
    highp vec4 tl = texelFetch(u_velocity, c.yz, 0);
    highp vec4 tr = texelFetch(u_velocity, c.xz, 0);
    highp vec4 bl = texelFetch(u_velocity, c.yw, 0);
    highp vec4 br = texelFetch(u_velocity, c.xw, 0);

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

    highp vec4 t = mix(mix(bl, br, fxy.x), mix(tl, tr, fxy.x), fxy.y);

    highp vec2 velocity = vec2(u_data_offset + dot(t.rg, u_data_scale.yx), -(u_data_offset + dot(t.ba, u_data_scale.yx)));
    velocity /= max(u_max_speed, length(velocity));
    return velocity;
}
#endif

uniform highp float u_particle_pos_scale;
uniform highp vec2 u_particle_pos_offset;

highp vec2 decode_pos(highp vec4 pixel) {
    highp vec2 p = vec2(
        pixel.r / 255.0 + pixel.b,
        pixel.g / 255.0 + pixel.a);

    return u_particle_pos_scale * p - u_particle_pos_offset;
}

highp vec4 encode_pos(highp vec2 pos) {
    highp vec2 p = (pos + u_particle_pos_offset) / u_particle_pos_scale;
    return vec4(
        fract(p * 255.0),
        floor(p * 255.0) / 255.0);
}
