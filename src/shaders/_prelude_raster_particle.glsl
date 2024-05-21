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

// Fixed packing code from: https://github.com/mrdoob/three.js/pull/17935
highp vec4 pack_pos_to_rgba(highp vec2 p) {
    highp vec2 v = (p + u_particle_pos_offset) / u_particle_pos_scale;
	highp vec4 r = vec4(v.x, fract(v.x * 255.0), v.y, fract(v.y * 255.0));
	return vec4(r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w);
}

highp vec2 unpack_pos_from_rgba(highp vec4 v) {
	v = floor(v * 255.0 + 0.5) / 255.0;
	highp vec2 p = vec2(v.x + (v.y / 255.0), v.z + (v.w / 255.0));
    return u_particle_pos_scale * p - u_particle_pos_offset;
}
