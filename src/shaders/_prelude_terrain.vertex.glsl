#ifdef TERRAIN

uniform sampler2D u_dem;
uniform sampler2D u_dem_prev;
uniform vec4 u_dem_unpack;
uniform vec4 u_dem_unpack_prev;
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

vec4 tileUvToDemSample(vec2 uv, float dem_size, float dem_scale, vec2 dem_tl) {
    vec2 pos = dem_size * (uv * dem_scale + dem_tl) + 1.0;
    vec2 f = fract(pos);
    return vec4((pos - f + 0.5) / (dem_size + 2.0), f);
}

float decodeElevation(vec4 v, vec4 unpackVector) {
    return dot(vec4(v.xyz * 255.0, -1.0), unpackVector);
}

float currentElevation(vec2 apos) {
    float dd = 1.0 / (u_dem_size + 2.0);
    vec4 r = tileUvToDemSample(apos / 8192.0, u_dem_size, u_dem_scale, u_dem_tl);
    vec2 pos = r.xy;
    vec2 f = r.zw;

    float tl = decodeElevation(texture2D(u_dem, pos), u_dem_unpack);
    float tr = decodeElevation(texture2D(u_dem, pos + vec2(dd, 0.0)), u_dem_unpack);
    float bl = decodeElevation(texture2D(u_dem, pos + vec2(0.0, dd)), u_dem_unpack);
    float br = decodeElevation(texture2D(u_dem, pos + vec2(dd, dd)), u_dem_unpack);

    return u_exaggeration * mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
}

float prevElevation(vec2 apos) {
    float dd = 1.0 / (u_dem_size + 2.0);
    vec4 r = tileUvToDemSample(apos / 8192.0, u_dem_size, u_dem_scale_prev, u_dem_tl_prev);
    vec2 pos = r.xy;
    vec2 f = r.zw;

    float tl = decodeElevation(texture2D(u_dem_prev, pos), u_dem_unpack_prev);
    float tr = decodeElevation(texture2D(u_dem_prev, pos + vec2(dd, 0.0)), u_dem_unpack_prev);
    float bl = decodeElevation(texture2D(u_dem_prev, pos + vec2(0.0, dd)), u_dem_unpack_prev);
    float br = decodeElevation(texture2D(u_dem_prev, pos + vec2(dd, dd)), u_dem_unpack_prev);

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

// Unpack depth from RGBA. A piece of code copied in various libraries and WebGL
// shadow mapping examples.
float unpack_depth(vec4 rgba_depth)
{
    const vec4 bit_shift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
    return dot(rgba_depth, bit_shift);
}

bool isOccluded(vec4 frag) {
    vec3 coord = frag.xyz / frag.w;
    float depth = unpack_depth(texture2D(u_depth, (coord.xy + 1.0) * 0.5));
    return depth * (coord.z - depth) > 0.0005; // === coord.z > depth + 0.0005 / depth;
}

vec4 fourSample(vec2 pos, vec2 off) {
    vec4 demtl = vec4(texture2D(u_dem, pos).xyz * 255.0, -1.0);
    float tl = dot(demtl, u_dem_unpack);
    vec4 demtr = vec4(texture2D(u_dem, pos + vec2(off.x, 0.0)).xyz * 255.0, -1.0);
    float tr = dot(demtr, u_dem_unpack);
    vec4 dembl = vec4(texture2D(u_dem, pos + vec2(0.0, off.y)).xyz * 255.0, -1.0);
    float bl = dot(dembl, u_dem_unpack);
    vec4 dembr = vec4(texture2D(u_dem, pos + off).xyz * 255.0, -1.0);
    float br = dot(dembr, u_dem_unpack);
    return vec4(tl, tr, bl, br);
}

float flatElevation(vec2 pack) {
    vec2 apos = floor(pack / 8.0);
    vec2 span = 10.0 * (pack - apos * 8.0);

    vec2 uvTex = (apos - vec2(1.0, 1.0)) / 8190.0;
    float size = u_dem_size + 2.0;
    float dd = 1.0 / size;

    vec2 pos = u_dem_size * (uvTex * u_dem_scale + u_dem_tl) + 1.0;
    vec2 f = fract(pos);
    pos = (pos - f + 0.5) * dd;

    // Get elevation of centroid.
    vec4 h = fourSample(pos, vec2(dd));
    float z = mix(mix(h.x, h.y, f.x), mix(h.z, h.w, f.x), f.y);

    vec2 w = floor(0.5 * (span * u_meter_to_dem - 1.0));
    vec2 d = dd * w;
    vec4 bounds = vec4(d, vec2(1.0) - d);
    
    // Get building wide sample, to get better slope estimate.
    h = fourSample(pos - d, 2.0 * d + vec2(dd));

    vec4 diff = abs(h.xzxy - h.ywzw);
    vec2 slope = min(vec2(0.25), u_meter_to_dem * 0.5 * (diff.xz + diff.yw) / (2.0 * w + vec2(1.0)));
    vec2 fix = slope * span;
    float base = z + max(fix.x, fix.y);
    return u_exaggeration * base;
}

float elevationFromUint16(float word) {
    return u_exaggeration * word / 7.3;
}

#else

float elevation(vec2 pos) { return 0.0; }
bool isOccluded(vec4 frag) { return false; }

#endif