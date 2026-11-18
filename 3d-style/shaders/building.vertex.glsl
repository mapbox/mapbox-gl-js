#include "_prelude_fog.vertex.glsl"
#include "_prelude_shadow.vertex.glsl"
#include "_prelude_feature_cutout.vertex.glsl"

in ivec2 a_pos_packed;
in vec4 a_normal_4n;
#ifndef PAINT_TABLE
in ivec4 a_centroid_3;
#endif

#ifndef PAINT_TABLE
#ifdef FLOOD_LIGHT
in int a_flood_light_wall_radius_1i16;
#endif
#ifdef BUILDING_FAUX_FACADE
in uvec2 a_faux_facade_vertical_range;
#endif
#endif

#ifdef BUILDING_FAUX_FACADE
in uvec4 a_faux_facade_data;
#endif

uniform mat4 u_matrix;
uniform mat4 u_normal_matrix;
uniform highp float u_tile_to_meter;

#if defined(RENDER_FRONT_CUTOFF) || defined(ROUTE_CORRIDOR)
#ifdef RENDER_FRONT_CUTOFF
uniform vec3 u_front_cutoff_params; // [start, range, opacity]
#endif
out float v_dither_opacity;
#endif

out vec4 v_color;
out vec3 v_normal;
out highp vec3 v_pos;


#ifdef BUILDING_FAUX_FACADE
out lowp float v_faux_facade;
out highp float v_faux_facade_ed;
out highp vec2 v_faux_facade_window;
out highp vec2 v_faux_facade_floor;
out highp vec2 v_faux_facade_range;
out highp float v_aspect;
out highp vec3 v_tbn_0;
out highp vec3 v_tbn_1;
out highp vec3 v_tbn_2;
out highp vec4 v_faux_color_emissive;
#endif

#ifdef RENDER_SHADOWS
uniform mat4 u_light_matrix_0;
uniform mat4 u_light_matrix_1;
out highp vec4 v_pos_light_view_0;
out highp vec4 v_pos_light_view_1;
#endif

#ifdef FLOOD_LIGHT
out highp float v_flood_radius; // in tile coordinates
out float v_has_flood_light;
#endif

const float MAX_UINT_16 = 65535.0;
const float MAX_INT_16 = 32767.0;
const float MAX_UINT_8 = 255.0;
const float MAX_INT_8 = 127.0;
const float TWO_POW_8 = 256.0;
const float FLOOD_LIGHT_MAX_RADIUS_METER = 2048.0;

vec3 sRGBToLinear(vec3 srgbIn) {
    return pow(srgbIn, vec3(2.2));
}

#ifdef BUILDING_FAUX_FACADE
mat3 get_tbn(in vec3 normal) {
    const vec3 bitangent = vec3(0.0, 0.0, 1.0);
    vec3 tangent = normalize(vec3(normal.y, -normal.x, 0.0)); // -cross(bitangent, normal);
    return mat3(tangent, bitangent, normal);
}
#endif
#ifdef PAINT_TABLE
// Per-footprint styling, see BuildingPaintRow for the layout. a_paint_row is (row << 2) | part and
// a_normal_4n.w holds the ambient occlusion.
#define PAINT_TABLE_UBO_VEC4 4096

in highp uint a_paint_row;
uniform float u_building_ao_intensity;

layout(std140) uniform PaintTableUniform {
    uvec4 rows[PAINT_TABLE_UBO_VEC4];
} u_paint_table;

// Explicit swizzles instead of dynamic vector indexing (old Adreno driver bugs).
uint paint_table_dword(uvec4 v, uint index) {
    return (index == 0u) ? v.x : (index == 1u) ? v.y : (index == 2u) ? v.z : v.w;
}

vec4 paint_table_unpack_rgba8(uint packed) {
    return vec4(uvec4(packed >> 24u, (packed >> 16u) & 255u, (packed >> 8u) & 255u, packed & 255u)) / 255.0;
}

ivec4 paint_table_unpack_int16x4(uvec4 v) {
    return ivec4(int(v.x << 16u) >> 16, int(v.x) >> 16, int(v.y << 16u) >> 16, int(v.y) >> 16);
}
#endif
#pragma mapbox: define-attribute-vertex-shader-only highp uvec2 part_color_emissive
#pragma mapbox: define-attribute-vertex-shader-only highp uvec2 faux_facade_color_emissive

invariant gl_Position;
void main() {
    #pragma mapbox: initialize-attribute-custom highp uvec2 part_color_emissive
    #pragma mapbox: initialize-attribute-custom highp uvec2 faux_facade_color_emissive

#ifdef PAINT_TABLE
    uint paint_row = a_paint_row >> 2u;
    uvec4 paint_parts = u_paint_table.rows[paint_row * 2u];
    uvec4 paint_misc = u_paint_table.rows[paint_row * 2u + 1u];
    ivec4 centroid_3 = paint_table_unpack_int16x4(paint_misc);
    vec4 color_emissive = paint_table_unpack_rgba8(paint_table_dword(paint_parts, a_paint_row & 3u));
    color_emissive.rgb *= mix(1.0, a_normal_4n.w, u_building_ao_intensity);
#else
    ivec4 centroid_3 = a_centroid_3;
    vec4 color_emissive = decode_color(vec2(part_color_emissive));
#endif
    v_color = vec4(sRGBToLinear(color_emissive.rgb), color_emissive.a);

#ifdef FLOOD_LIGHT
#ifdef PAINT_TABLE
    // Only walls are flood lit (part 0).
    float flood_light_wall_radius = (a_paint_row & 3u) == 0u ? float(int(paint_misc.z << 16u) >> 16) : -1.0;
#else
    float flood_light_wall_radius = float(a_flood_light_wall_radius_1i16);
#endif
    v_flood_radius = (flood_light_wall_radius / MAX_INT_16 * FLOOD_LIGHT_MAX_RADIUS_METER);
    v_has_flood_light = step(0.0, v_flood_radius);
#endif

    v_normal = vec3(u_normal_matrix * vec4(a_normal_4n.xyz, 0.0));

    float hidden = 0.0;
    float depth_offset = 0.0;
    // Declared at function scope so lifted FUNC_CONST if-blocks share them (shader-pipeline).
    float frontCutoffOpacity = 1.0;
    float routeFade = 0.0;

    // Decode centroid position and span from packed attribute.
    // Encoding: cx_encoded = clamp(cx, 0, 8191) * 4 + spanXbits (2 bits per axis)
    vec2 centroid_xy = vec2(centroid_3.xy >> 2);
    vec2 spanBits = vec2(centroid_3.xy & 3);

#ifdef BUILDING_FAUX_FACADE
    vec4 faux_facade_data = vec4(a_faux_facade_data);
    v_faux_facade = faux_facade_data.x;
    if (v_faux_facade > 0.0) {
        v_faux_facade_ed = faux_facade_data.x  * u_tile_to_meter;

        float window_x_perc = floor(faux_facade_data.y / TWO_POW_8);
        float window_y_perc = faux_facade_data.y - TWO_POW_8 * window_x_perc;
        vec2 window_perc = vec2(window_x_perc, window_y_perc) / MAX_UINT_8;

        v_faux_facade_floor = (faux_facade_data.zw / MAX_UINT_16 * EXTENT) * u_tile_to_meter;
        v_faux_facade_window = window_perc * v_faux_facade_floor;

#ifdef PAINT_TABLE
        vec2 faux_facade_range = vec2(paint_misc.w & 0xFFFFu, paint_misc.w >> 16u);
#else
        vec2 faux_facade_range = vec2(a_faux_facade_vertical_range);
#endif
        v_faux_facade_range = (faux_facade_range / MAX_UINT_16 * EXTENT) * u_tile_to_meter;

        v_aspect = v_faux_facade_window.x / v_faux_facade_window.y;

        mat3 tbn = get_tbn(normalize(v_normal));
        v_tbn_0 = tbn[0];
        v_tbn_1 = tbn[1];
        v_tbn_2 = tbn[2];

#ifdef PAINT_TABLE
        v_faux_color_emissive = paint_table_unpack_rgba8(paint_parts.z); // window part, no ambient occlusion
#else
        v_faux_color_emissive = decode_color(vec2(faux_facade_color_emissive));
#endif
        v_faux_color_emissive.rgb = sRGBToLinear(v_faux_color_emissive.rgb);

        depth_offset = min(1000.0, float(centroid_3.z)) * 0.0000002;
    }
#endif
    v_pos = vec3(float(a_pos_packed.x >> 16), float((a_pos_packed.x << 16) >> 16), intBitsToFloat(a_pos_packed.y));

#if defined(RENDER_CUTOFF) || defined(RENDER_FRONT_CUTOFF)
    float halfSpanX = spanBits.x * 10.0 / u_tile_to_meter;
    float halfSpanY = spanBits.y * 10.0 / u_tile_to_meter;
    vec2 screenUpInTile = vec2(u_matrix[0][1], u_matrix[1][1]);
    vec2 spanOffset = vec2(halfSpanX, halfSpanY) * sign(screenUpInTile);
    vec2 cutoff_highestCorner = centroid_xy + spanOffset;
    vec2 cutoff_lowestCorner = centroid_xy - spanOffset;
#endif

#if defined(RENDER_CUTOFF) || defined(RENDER_FRONT_CUTOFF)
    vec4 ground = u_matrix * vec4(centroid_xy, 0.0, 1.0);
#endif

#ifdef RENDER_CUTOFF
    v_cutoff_opacity = cutoff_opacity(u_cutoff_params, native_clip_z_to_cutoff_depth(ground.z, ground.w));
    hidden = float(v_cutoff_opacity == 0.0);
    v_pos.z *= v_cutoff_opacity;
#endif

#ifdef RENDER_SHADOWS
    vec3 shadow_pos = v_pos;
#ifdef NORMAL_OFFSET
    vec3 offset = shadow_normal_offset_model(v_normal);
    shadow_pos += offset * shadow_normal_offset_multiplier0();
#endif
    v_pos_light_view_0 = u_light_matrix_0 * vec4(shadow_pos, 1.0);
    v_pos_light_view_1 = u_light_matrix_1 * vec4(shadow_pos, 1.0);
#endif

#ifdef FOG
    v_fog_pos = fog_position(v_pos);
#endif

#ifdef RENDER_FRONT_CUTOFF
    {
        hidden = max(hidden, float(ground.w <= 0.0));
        float ndc_y = ground.y / max(ground.w, 0.001);
        float threshold = u_front_cutoff_params.x * 2.0 - 1.0;
        float range_ndc = u_front_cutoff_params.y * 2.0;
        hidden = max(hidden, float(ndc_y < threshold - range_ndc));
        float t = clamp((ndc_y - (threshold - range_ndc)) / max(range_ndc, 0.001), 0.0, 1.0);
        frontCutoffOpacity = mix(u_front_cutoff_params.z, 1.0, t);
    }
#endif

#if defined(RENDER_FRONT_CUTOFF) || defined(ROUTE_CORRIDOR)
#ifdef ROUTE_CORRIDOR
    float tileUnitsPerMeter = floor(u_route_corridor[3].w);
    // a_centroid_3.w: packed AABB half-meters (high byte X, low byte Y).
    uint packedSpan = uint(centroid_3.w) & 0xFFFFu;
    float sxHalf = float((packedSpan >> 8u) & 255u) * tileUnitsPerMeter;
    float syHalf = float(packedSpan & 255u) * tileUnitsPerMeter;
    float roofZ = float(centroid_3.z);
    routeFade = computeRouteCorridorCentroidFade(centroid_xy, roofZ, sxHalf, syHalf);
#endif
    v_dither_opacity = 1.0;
#ifdef ROUTE_CORRIDOR
    v_dither_opacity = min(v_dither_opacity, 1.0 - routeFade);
#endif
#ifdef RENDER_FRONT_CUTOFF
    v_dither_opacity = min(v_dither_opacity, frontCutoffOpacity);
#endif
    hidden = max(hidden, float(v_dither_opacity <= 0.0));
#endif

    gl_Position = mix(u_matrix * vec4(v_pos, 1), AWAY, hidden);
    gl_Position.z -= depth_offset * gl_Position.w;

}
