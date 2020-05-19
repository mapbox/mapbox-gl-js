#ifdef TERRAIN

uniform sampler2D u_dem;
uniform vec4 u_dem_unpack;
uniform vec2 u_dem_tl;
uniform float u_dem_scale;
uniform float u_dem_size;
uniform float u_exaggeration;
uniform float u_meter_to_dem;

uniform sampler2D u_depth;

float elevation(vec2 apos) {
    vec2 uvTex = apos / 8192.0;
    float size = u_dem_size + 2.0;
    float dd = 1.0 / size;

    vec2 pos = u_dem_size * (uvTex * u_dem_scale + u_dem_tl) + 1.0;
    vec2 f = fract(pos);
    pos = (pos - f + 0.5) * dd;

    vec4 dem = vec4(texture2D(u_dem, pos).xyz * 255.0, -1.0);
    float tl = dot(dem, u_dem_unpack);

    vec4 demtr = vec4(texture2D(u_dem, pos + vec2(dd, 0.0)).xyz * 255.0, -1.0);
    float tr = dot(demtr, u_dem_unpack);
    vec4 dembl = vec4(texture2D(u_dem, pos + vec2(0.0, dd)).xyz * 255.0, -1.0);
    float bl = dot(dembl, u_dem_unpack);
    vec4 dembr = vec4(texture2D(u_dem, pos + vec2(dd, dd)).xyz * 255.0, -1.0);
    float br = dot(dembr, u_dem_unpack);

    return u_exaggeration * mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
}

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

bool hideIfOccluded(vec4 frag) {
    if (isOccluded(frag)) {
        const float AWAY = -1000.0;
        gl_Position = vec4(AWAY, AWAY, AWAY, 1.0);
        return true;
    }
    return false;
}

float flatElevation(vec2 pack, float height) {
    vec2 apos = floor(pack / 8.0);
    vec2 span = 10.0 * (pack - apos * 8.0);
    vec2 uvTex = apos / 8191.0;
    float size = u_dem_size + 2.0;
    float dd = 1.0 / size;

    vec2 pos = u_dem_size * (uvTex * u_dem_scale + u_dem_tl) + 0.5;
    pos = pos * dd;

    vec4 demtl = vec4(texture2D(u_dem, pos).xyz * 255.0, -1.0);
    float tl = dot(demtl, u_dem_unpack);
    vec4 demtr = vec4(texture2D(u_dem, pos + vec2(dd, 0.0)).xyz * 255.0, -1.0);
    float tr = dot(demtr, u_dem_unpack);
    vec4 dembl = vec4(texture2D(u_dem, pos + vec2(0.0, dd)).xyz * 255.0, -1.0);
    float bl = dot(dembl, u_dem_unpack);
    vec4 dembr = vec4(texture2D(u_dem, pos + vec2(dd, dd)).xyz * 255.0, -1.0);
    float br = dot(dembr, u_dem_unpack);

    vec4 s = vec4(tl, tr, bl, br);
    vec4 diff = abs(s.xzxy - s.ywzw);
    vec2 slope = min(vec2(0.25), 0.5 * (diff.xz + diff.yw) * u_meter_to_dem);
    vec2 fix = slope * span;
    float base = min(min(tl, tr), min(bl, br)) + max(fix.x, fix.y);
    return u_exaggeration * base;
}

#else

float elevation(vec2 pos) { return 0.0; }
bool isOccluded(vec4 frag) { return false; }
bool hideIfOccluded(vec4 frag) { return false; }

#endif