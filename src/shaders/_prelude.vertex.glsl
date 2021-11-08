// NOTE: This prelude is injected in the vertex shader only

float wrap(float n, float min, float max) {
    float d = max - min;
    float w = mod(mod(n - min, d) + d, d) + min;
    return (w == min) ? max : w;
}

vec3 mercator_tile_position(mat4 matrix, vec2 tile_anchor, vec3 tile_id, vec2 mercator_center) {
#if defined(PROJECTION_GLOBE_VIEW) && !defined(PROJECTED_POS_ON_VIEWPORT)
    // tile_id.z contains pow(2.0, coord.canonical.z)
    float tiles = tile_id.z;

    vec2 mercator = (tile_anchor / EXTENT + tile_id.xy) / tiles;
    mercator -= mercator_center;
    mercator.x = wrap(mercator.x, -0.5, 0.5);

    vec4 mercator_tile = vec4(mercator.xy * EXTENT, EXTENT / (2.0 * PI), 1.0);
    mercator_tile = matrix * mercator_tile;

    return mercator_tile.xyz;
#else
    return vec3(0.0);
#endif
}

vec3 mix_globe_mercator(vec3 globe, vec3 mercator, float t) {
#if defined(PROJECTION_GLOBE_VIEW) && !defined(PROJECTED_POS_ON_VIEWPORT)
    return mix(globe, mercator, t);
#else
    return globe;
#endif
}

#ifdef PROJECTION_GLOBE_VIEW
mat3 globe_mercator_surface_vectors(vec3 pos_normal, vec3 up_dir, float zoom_transition) {
    vec3 normal = zoom_transition == 0.0 ? pos_normal : normalize(mix(pos_normal, up_dir, zoom_transition));
    vec3 xAxis = normalize(vec3(normal.z, 0.0, -normal.x));
    vec3 yAxis = normalize(cross(normal, xAxis));
    return mat3(xAxis, yAxis, normal);
}
#endif

// Unpack a pair of values that have been packed into a single float.
// The packed values are assumed to be 8-bit unsigned integers, and are
// packed like so:
// packedValue = floor(input[0]) * 256 + input[1],
vec2 unpack_float(const float packedValue) {
    int packedIntValue = int(packedValue);
    int v0 = packedIntValue / 256;
    return vec2(v0, packedIntValue - v0 * 256);
}

vec2 unpack_opacity(const float packedOpacity) {
    int intOpacity = int(packedOpacity) / 2;
    return vec2(float(intOpacity) / 127.0, mod(packedOpacity, 2.0));
}

// To minimize the number of attributes needed, we encode a 4-component
// color into a pair of floats (i.e. a vec2) as follows:
// [ floor(color.r * 255) * 256 + color.g * 255,
//   floor(color.b * 255) * 256 + color.g * 255 ]
vec4 decode_color(const vec2 encodedColor) {
    return vec4(
        unpack_float(encodedColor[0]) / 255.0,
        unpack_float(encodedColor[1]) / 255.0
    );
}

// Unpack a pair of paint values and interpolate between them.
float unpack_mix_vec2(const vec2 packedValue, const float t) {
    return mix(packedValue[0], packedValue[1], t);
}

// Unpack a pair of paint values and interpolate between them.
vec4 unpack_mix_color(const vec4 packedColors, const float t) {
    vec4 minColor = decode_color(vec2(packedColors[0], packedColors[1]));
    vec4 maxColor = decode_color(vec2(packedColors[2], packedColors[3]));
    return mix(minColor, maxColor, t);
}

// The offset depends on how many pixels are between the world origin and the edge of the tile:
// vec2 offset = mod(pixel_coord, size)
//
// At high zoom levels there are a ton of pixels between the world origin and the edge of the tile.
// The glsl spec only guarantees 16 bits of precision for highp floats. We need more than that.
//
// The pixel_coord is passed in as two 16 bit values:
// pixel_coord_upper = floor(pixel_coord / 2^16)
// pixel_coord_lower = mod(pixel_coord, 2^16)
//
// The offset is calculated in a series of steps that should preserve this precision:
vec2 get_pattern_pos(const vec2 pixel_coord_upper, const vec2 pixel_coord_lower,
    const vec2 pattern_size, const float tile_units_to_pixels, const vec2 pos) {

    vec2 offset = mod(mod(mod(pixel_coord_upper, pattern_size) * 256.0, pattern_size) * 256.0 + pixel_coord_lower, pattern_size);
    return (tile_units_to_pixels * pos + offset) / pattern_size;
}

const vec4 AWAY = vec4(-1000.0, -1000.0, -1000.0, 1); // Normalized device coordinate that is not rendered.
