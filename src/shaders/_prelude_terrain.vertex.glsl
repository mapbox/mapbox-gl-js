// Also declared in data/bucket/fill_extrusion_bucket.js
#define ELEVATION_SCALE 7.0
#define ELEVATION_OFFSET 450.0

#ifdef PROJECTION_GLOBE_VIEW

uniform vec3 u_tile_tl_up;
uniform vec3 u_tile_tr_up;
uniform vec3 u_tile_br_up;
uniform vec3 u_tile_bl_up;
uniform float u_tile_up_scale;
vec3 elevationVector(vec2 pos) {
    vec2 uv = pos / EXTENT;
    vec3 up = normalize(mix(
        mix(u_tile_tl_up, u_tile_tr_up, uv.xxx),
        mix(u_tile_bl_up, u_tile_br_up, uv.xxx),
        uv.yyy));
    return up * u_tile_up_scale;
}

#else 

vec3 elevationVector(vec2 pos) { return vec3(0, 0, 1); }

#endif

#ifdef TERRAIN

#ifdef TERRAIN_DEM_FLOAT_FORMAT
uniform highp sampler2D u_dem;
uniform highp sampler2D u_dem_prev;
#else
uniform sampler2D u_dem;
uniform sampler2D u_dem_prev;
#endif
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
#ifdef TERRAIN_DEM_FLOAT_FORMAT
    vec2 pos = (u_dem_size * (apos / 8192.0 * u_dem_scale + u_dem_tl) + 1.5) / (u_dem_size + 2.0);
    return u_exaggeration * texture2D(u_dem, pos).a;
#else
    float dd = 1.0 / (u_dem_size + 2.0);
    vec4 r = tileUvToDemSample(apos / 8192.0, u_dem_size, u_dem_scale, u_dem_tl);
    vec2 pos = r.xy;
    vec2 f = r.zw;

    float tl = decodeElevation(texture2D(u_dem, pos));
#ifdef TERRAIN_DEM_NEAREST_FILTER
    return u_exaggeration * tl;
#endif
    float tr = decodeElevation(texture2D(u_dem, pos + vec2(dd, 0.0)));
    float bl = decodeElevation(texture2D(u_dem, pos + vec2(0.0, dd)));
    float br = decodeElevation(texture2D(u_dem, pos + vec2(dd, dd)));

    return u_exaggeration * mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
#endif
}

float prevElevation(vec2 apos) {
#ifdef TERRAIN_DEM_FLOAT_FORMAT
    vec2 pos = (u_dem_size * (apos / 8192.0 * u_dem_scale_prev + u_dem_tl_prev) + 1.5) / (u_dem_size + 2.0);
    return u_exaggeration * texture2D(u_dem_prev, pos).a;
#else
    float dd = 1.0 / (u_dem_size + 2.0);
    vec4 r = tileUvToDemSample(apos / 8192.0, u_dem_size, u_dem_scale_prev, u_dem_tl_prev);
    vec2 pos = r.xy;
    vec2 f = r.zw;

    float tl = decodeElevation(texture2D(u_dem_prev, pos));
    float tr = decodeElevation(texture2D(u_dem_prev, pos + vec2(dd, 0.0)));
    float bl = decodeElevation(texture2D(u_dem_prev, pos + vec2(0.0, dd)));
    float br = decodeElevation(texture2D(u_dem_prev, pos + vec2(dd, dd)));

    return u_exaggeration * mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
#endif
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
    return dot(rgba_depth, bit_shift) * 2.0 - 1.0;
}

bool isOccluded(vec4 frag) {
    vec3 coord = frag.xyz / frag.w;
    float depth = unpack_depth(texture2D(u_depth, (coord.xy + 1.0) * 0.5));
    return coord.z > depth + 0.0005;
}

float occlusionFade(vec4 frag) {
    vec3 coord = frag.xyz / frag.w;

    vec3 df = vec3(5.0 * u_depth_size_inv, 0.0);
    vec2 uv = 0.5 * coord.xy + 0.5;
    vec4 depth = vec4(
        unpack_depth(texture2D(u_depth, uv - df.xz)),
        unpack_depth(texture2D(u_depth, uv + df.xz)),
        unpack_depth(texture2D(u_depth, uv - df.zy)),
        unpack_depth(texture2D(u_depth, uv + df.zy))
    );
    return dot(vec4(0.25), vec4(1.0) - clamp(300.0 * (vec4(coord.z - 0.001) - depth), 0.0, 1.0));
}

 // BEGIN: code for fill-extrusion height offseting
 // When making changes here please also update associated JS ports in src/style/style_layer/fill-extrusion-style-layer.js
 // This is so that rendering changes are reflected on CPU side for feature querying.

vec4 fourSample(vec2 pos, vec2 off) {
#ifdef TERRAIN_DEM_FLOAT_FORMAT
    float tl = texture2D(u_dem, pos).a;
    float tr = texture2D(u_dem, pos + vec2(off.x, 0.0)).a;
    float bl = texture2D(u_dem, pos + vec2(0.0, off.y)).a;
    float br = texture2D(u_dem, pos + off).a;
#else
    vec4 demtl = vec4(texture2D(u_dem, pos).xyz * 255.0, -1.0);
    float tl = dot(demtl, u_dem_unpack);
    vec4 demtr = vec4(texture2D(u_dem, pos + vec2(off.x, 0.0)).xyz * 255.0, -1.0);
    float tr = dot(demtr, u_dem_unpack);
    vec4 dembl = vec4(texture2D(u_dem, pos + vec2(0.0, off.y)).xyz * 255.0, -1.0);
    float bl = dot(dembl, u_dem_unpack);
    vec4 dembr = vec4(texture2D(u_dem, pos + off).xyz * 255.0, -1.0);
    float br = dot(dembr, u_dem_unpack);
#endif
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
    return u_exaggeration * (word / ELEVATION_SCALE - ELEVATION_OFFSET);
}

// END: code for fill-extrusion height offseting

#else

float elevation(vec2 pos) { return 0.0; }
bool isOccluded(vec4 frag) { return false; }
float occlusionFade(vec4 frag) { return 1.0; }

#endif
