#define MIN_ELEV -10000.0
#define MAX_ELEV 10000.0

#ifdef GL_ES
precision highp float;
#endif
varying vec2 v_pos;
#ifdef TERRAIN

uniform sampler2D u_dem;
uniform sampler2D u_dem_prev;
uniform vec4 u_dem_unpack;
uniform vec2 u_dem_tl;
uniform vec2 u_dem_tl_prev;
uniform float u_dem_scale;
uniform float u_dem_scale_prev;
uniform float u_dem_size;
uniform float u_dem_lerp;
uniform float u_exaggeration;
uniform float u_meter_to_dem;
uniform mat4 u_label_plane_matrix_inv;

uniform sampler2D u_depth;
uniform vec2 u_depth_size_inv;

vec4 tileUvToDemSample(vec2 uv, float dem_size, float dem_scale, vec2 dem_tl) {
    vec2 pos = dem_size * (uv * dem_scale + dem_tl) + 1.0;
    vec2 f = fract(pos);
    return vec4((pos - f + 0.5) / (dem_size + 2.0), f);
}

float decodeElevation(vec4 v) {
    return dot(vec4(v.xyz * 255.0, -1.0), u_dem_unpack);
}

float currentElevation(vec2 apos) {
    float dd = 1.0 / (u_dem_size + 2.0);
    vec4 r = tileUvToDemSample(apos / 8192.0, u_dem_size, u_dem_scale, u_dem_tl);
    vec2 pos = r.xy;
    vec2 f = r.zw;

    float tl = decodeElevation(texture2D(u_dem, pos));
    float tr = decodeElevation(texture2D(u_dem, pos + vec2(dd, 0.0)));
    float bl = decodeElevation(texture2D(u_dem, pos + vec2(0.0, dd)));
    float br = decodeElevation(texture2D(u_dem, pos + vec2(dd, dd)));

    return u_exaggeration * mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
}

float prevElevation(vec2 apos) {
    float dd = 1.0 / (u_dem_size + 2.0);
    vec4 r = tileUvToDemSample(apos / 8192.0, u_dem_size, u_dem_scale_prev, u_dem_tl_prev);
    vec2 pos = r.xy;
    vec2 f = r.zw;

    float tl = decodeElevation(texture2D(u_dem_prev, pos));
    float tr = decodeElevation(texture2D(u_dem_prev, pos + vec2(dd, 0.0)));
    float bl = decodeElevation(texture2D(u_dem_prev, pos + vec2(0.0, dd)));
    float br = decodeElevation(texture2D(u_dem_prev, pos + vec2(dd, dd)));

    return u_exaggeration * mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
}

#ifdef TERRAIN_VERTEX_MORPHING
float elevation(vec2 apos) {
    float nextElevation = currentElevation(apos);
    float prevElevation = prevElevation(apos);
    return mix(prevElevation, nextElevation, u_dem_lerp);
}
#else
float elevation(vec2 apos) {
    return currentElevation(apos);
}
#endif

#else

float elevation(vec2 pos) { return 0.0; }
#endif

// Pack depth to RGBA. A piece of code copied in various libraries and WebGL
// shadow mapping examples.
vec4 pack_normalized(float n) {
    const vec4 bit_shift = vec4(256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0);
    const vec4 bit_mask  = vec4(0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);
    vec4 res = fract(n * bit_shift);
    res -= res.xxyz * bit_mask;
    return res;
}

void main() {
    gl_FragColor = pack_normalized((elevation(v_pos) - MIN_ELEV)/(MAX_ELEV - MIN_ELEV));
}
