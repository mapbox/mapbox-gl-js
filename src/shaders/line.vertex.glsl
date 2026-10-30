#include "_prelude_fog.vertex.glsl"
#include "_prelude_shadow.vertex.glsl"
#include "_prelude_terrain.vertex.glsl"
#include "_prelude_ubo_properties.glsl"

// floor(127 / 2) == 63.0
// the maximum allowed miter limit is 2.0 at the moment. the extrude normal is
// stored in a byte (-128..127). we scale regular normals up to length 63, but
// there are also "special" normals that have a bigger length (of up to 126 in
// this case).
// #define scale 63.0
#define EXTRUDE_SCALE 0.015873016

in ivec2 a_pos_normal;
in uvec4 a_data;
#if defined(ELEVATED) || defined(ELEVATED_ROADS) || defined(VARIABLE_LINE_WIDTH) || defined(VARIABLE_LINE_EMISSIVE_STRENGTH)
in vec4 a_z_offset_width;
#endif
#ifdef DEBUG_ELEVATION_ID
in vec3 a_elevation_id_col;
#endif

#ifdef DEBUG_ELEVATION_ID
out vec3 v_elevation_id_col;
#endif

#ifdef ELEVATION_GROUND_SCALE
in float a_elevation_ground_scale;
#endif

#ifdef LINE_ROUND_JOIN_CLIP_BORDER_OVERLAP
// Tile coordinates of possibly conflicting segments whose border may overlap this vertex's own segment
// across each end of it: prevA, prevB, nextA, nextB coordinates, one per component, packed as y in the
// high 16 bits, x doubled in the low 16, with the bit left to flag whether test is needed at all.
in highp ivec4 a_round_join_conflict_segments;
#endif

// Includes in order: a_uv_x, a_split_index, a_line_progress to reduce attribute count on older devices.
// Only line-gradient, line-border-gradient and line-trim-offset will requires a_packed info.
#if defined(RENDER_LINE_GRADIENT) || defined(RENDER_LINE_BORDER_GRADIENT) || defined(RENDER_LINE_TRIM_OFFSET)
in highp vec3 a_packed;
#endif

uniform bool u_has_dash;
uniform bool u_has_border;

in float a_linesofar;

uniform mat4 u_matrix;
uniform mat2 u_pixels_to_tile_units;
uniform vec2 u_units_to_pixels;
uniform lowp float u_device_pixel_ratio;
uniform float u_width_scale;
// Note: This value is zero if line-z-offset has feature dependencies,
// in that case the value is passed as a vertex attribute instead of a uniform.
uniform float u_z_offset;

// Elevated-road VLW carpet: clip-space z pulled toward camera, 0.5 m at the map center (0 when disabled).
// Always declared so GL locations resolve on all line program variants.
uniform highp float u_road_view_depth_bias;

#ifdef ELEVATED
uniform lowp float u_zbias_factor;
uniform lowp float u_tile_to_meter;

float sample_elevation(vec2 apos) {
#ifdef ELEVATION_REFERENCE_SEA
    return 0.0;
#else
    return elevation(apos);
#endif
}
#endif

out vec2 v_normal;
out vec4 v_width2_dilute; // xy fow width, z for dilute of whole line w for dilute of border
out float v_gamma_scale;
out highp vec2 v_tile_pos;

#ifdef LINE_ROUND_JOIN_CLIP_BORDER_OVERLAP
// Offset in pixel space from this vertex to the first coordinate of the conflicting segment beyond
// each end of its own segment. xy for the one before and zw for the one after.
out highp vec4 v_round_join_conflict_offset;
// Directions of the conflicting segments, first coordinate to second. Constant across every triangle
// that tests.
out highp vec4 v_round_join_conflict_dir;
// Flags whether to test against each of the conflicting segments.
out mediump vec2 v_round_join_conflict_test;
#endif

#ifdef ELEVATED_ROADS
out highp float v_road_z_offset;
#endif
#ifdef VARIABLE_LINE_WIDTH
out float stub_side;
out highp vec2 v_distance;
uniform float u_width_addition;
#endif

uniform highp float u_floor_width_scale;
uniform vec2 u_texsize;
uniform float u_tile_units_to_pixels;
out highp vec2 v_tex;

#if defined(RENDER_LINE_GRADIENT) || defined(RENDER_LINE_BORDER_GRADIENT) || defined(RENDER_LINE_TRIM_OFFSET)
out highp vec3 v_uv;
#endif

#if defined(RENDER_LINE_GRADIENT) || defined(RENDER_LINE_BORDER_GRADIENT)
uniform float u_image_height;
#endif

#ifdef INDICATOR_CUTOUT
out highp float v_z_offset;
#endif

#ifdef RENDER_SHADOWS
uniform mat4 u_light_matrix_0;
uniform mat4 u_light_matrix_1;

out highp vec4 v_pos_light_view_0;
out highp vec4 v_pos_light_view_1;
out highp float v_depth;
#endif

/// Line paint properties header size (in vec4 units).
#define LPP_HEADER_SIZE_VEC4 5u

/// Paint properties for a line layer.
struct LinePaintProperties {
    /// Non-premultiplied render line color.
    vec4 color;
    /// Non-premultiplied render border color.
    vec4 border_color;
    float opacity;
    float blur;
    float width;
    float gap_width;
    float offset;
    float floorwidth;
    float border_width;
    float emissive_strength;
    /// Raw dash-atlas descriptor [y, halfHeight|coverage<<4, lengthInt, lengthFract] (see
    /// LineAtlas.addDash) — never zoom-mixed, unlike every other member above (see readRaw).
    vec4 dash;
};

/// Constant paint properties values shared for all features.
uniform highp vec4 u_lpp_color;
uniform lowp vec4 u_lpp_border_color;
uniform lowp float u_lpp_opacity;
uniform lowp float u_lpp_blur;
uniform mediump float u_lpp_width;
uniform mediump float u_lpp_gap_width;
uniform lowp float u_lpp_offset;
uniform lowp float u_lpp_floorwidth;
uniform lowp float u_lpp_border_width;
uniform lowp float u_lpp_emissive_strength;
// highp: see LinePaintProperties.dash — mediump/FP16 overflows this range on e.g. Mali.
uniform highp vec4 u_lpp_dash;

/// Fractional part of the current render zoom used to derive every data-driven property's
/// zoom-interpolation factor from its packed [zm, zM] range (see zoomFactor() in _prelude_ubo_properties.glsl).
uniform highp float u_lpp_zoom_fraction;

/// Per-feature index of the feature's data-driven paint property block in the
/// u_lpp_properties uniform buffer, used directly (multiplied by the block size) — unlike
/// symbol, line has no appearance concept, so there's nothing to deduplicate and no
/// indirection block between this index and the properties buffer.
in float a_feature_index;

layout(std140) uniform LinePaintPropertiesHeaderUniform {
    /// Header contains information about the following:
    /// - Mask for which properties are data-driven (32-bit bitmask, 1 bit per property)
    /// - Size of a data-driven single block (in vec4 units)
    /// - Slot offset of each property within a data-driven block (in vec4 units)
    /// - Shared [zm, zM] zoom range for color/border_color, used since a color's own
    ///   block slot carries no per-feature zoom range (see line_properties_ubo.ts)
    uvec4 header[LPP_HEADER_SIZE_VEC4];
} u_lpp_header;

layout(std140) uniform LinePaintPropertiesUniform {
    /// Buffer contains vec4 aligned data-driven blocks (a single block per feature,
    /// multiple blocks for multiple features).
    vec4 properties[MAX_UBO_SIZE_VEC4];
} u_lpp_properties;

/// Line paint properties need to be interpolated and passed to the fragment shader.
out highp vec4 v_line_color;
out lowp vec4 v_border_color;
out lowp float v_opacity;
out lowp float v_blur;
out lowp float v_floorwidth;
out lowp float v_border_width;
out lowp float v_emissive_strength;
/// x = dash pattern length in tile units, y = dash coverage fraction in [0, 1] — both derived
/// from paint_properties.dash (see LinePaintProperties.dash) and read by the fragment shader.
out highp vec2 v_dash;

/// Read a data-driven color property: slot packs [minRG, minBA, maxRG, maxBA]. Falls back to
/// the constant uniform when the property isn't data-driven. Line colors never carry a
/// per-feature zoom range — always read the shared headerZoom range from the header.
vec4 readColor(uint base, bool isDataDriven, uint offsetVec4, vec2 headerZoom, vec4 fallbackValue) {
    if (!isDataDriven) return fallbackValue;
    vec4 value = u_lpp_properties.properties[base + offsetVec4];
    return unpack_mix_color(value, zoomFactor(headerZoom.x, headerZoom.y, u_lpp_zoom_fraction));
}

/// Read a data-driven scalar property: one vec4 slot packing [min, max, zm, zM].
/// Falls back to the constant uniform when the property isn't data-driven.
float readFloat(uint base, bool isDataDriven, uint offsetVec4, float fallbackValue) {
    if (!isDataDriven) return fallbackValue;
    vec4 slot = u_lpp_properties.properties[base + offsetVec4];
    return unpack_mix_vec2(slot.xy, zoomFactor(slot.z, slot.w, u_lpp_zoom_fraction));
}

/// Read a raw, never-zoom-mixed data-driven property slot verbatim — used only for
/// line-dasharray, whose 4 values are an opaque atlas descriptor (see LinePaintProperties.dash),
/// not a [min,max,zm,zM] pair. Falls back to the constant uniform when not data-driven.
highp vec4 readRaw(uint base, bool isDataDriven, uint offsetVec4, highp vec4 fallbackValue) {
    if (!isDataDriven) return fallbackValue;
    return u_lpp_properties.properties[base + offsetVec4];
}

LinePaintProperties readLinePaintProperties() {
    // Header dword layout: [0][0] = data-driven bitmask, [0][1] = reserved (unused for line),
    // [0][2] = block size in vec4 units, [0][3] and onward = per-property slot offsets within
    // the block (in vec4 units, dwords 3-13). [4] = shared zoom range for color/border_color
    // (dwords 16-19).
    uint dataDrivenMask = u_lpp_header.header[0][0];
    uint blockSizeVec4  = u_lpp_header.header[0][2];

    vec2 colorHeaderZoom  = uintBitsToFloat(u_lpp_header.header[4].xy);
    vec2 borderHeaderZoom = uintBitsToFloat(u_lpp_header.header[4].zw);

    // No indirection block for line (see a_feature_index doc above) — address the properties
    // block directly.
    uint base = uint(a_feature_index) * blockSizeVec4;

    LinePaintProperties props;
    props.color             = readColor(base, (dataDrivenMask & (1u << 0u)) != 0u, u_lpp_header.header[0][3], colorHeaderZoom, u_lpp_color);
    props.border_color      = readColor(base, (dataDrivenMask & (1u << 1u)) != 0u, u_lpp_header.header[1][0], borderHeaderZoom, u_lpp_border_color);
    props.opacity           = readFloat(base, (dataDrivenMask & (1u << 2u)) != 0u, u_lpp_header.header[1][1], u_lpp_opacity);
    props.blur              = readFloat(base, (dataDrivenMask & (1u << 3u)) != 0u, u_lpp_header.header[1][2], u_lpp_blur);
    props.width             = readFloat(base, (dataDrivenMask & (1u << 4u)) != 0u, u_lpp_header.header[1][3], u_lpp_width);
    props.gap_width         = readFloat(base, (dataDrivenMask & (1u << 5u)) != 0u, u_lpp_header.header[2][0], u_lpp_gap_width);
    props.offset            = readFloat(base, (dataDrivenMask & (1u << 6u)) != 0u, u_lpp_header.header[2][1], u_lpp_offset);
    props.floorwidth        = readFloat(base, (dataDrivenMask & (1u << 7u)) != 0u, u_lpp_header.header[2][2], u_lpp_floorwidth);
    props.border_width      = readFloat(base, (dataDrivenMask & (1u << 8u)) != 0u, u_lpp_header.header[2][3], u_lpp_border_width);
    props.emissive_strength = readFloat(base, (dataDrivenMask & (1u << 9u)) != 0u, u_lpp_header.header[3][0], u_lpp_emissive_strength);
    props.dash              = readRaw(base, (dataDrivenMask & (1u << 10u)) != 0u, u_lpp_header.header[3][1], u_lpp_dash);
    return props;
}

#ifdef LINE_ROUND_JOIN_CLIP_BORDER_OVERLAP
// xy is the tile coordinate, z the test flag carried in the low bit of the doubled x.
highp vec3 unpackRoundJoinTestCoordinate(highp int packedCoord) {
    highp int x = (((packedCoord & 0xfffe) ^ 0x8000) - 0x8000) >> 1;
    return vec3(float(x), float(packedCoord >> 16), float(packedCoord & 1));
}
#endif

void main() {
    LinePaintProperties paint_properties = readLinePaintProperties();
    v_line_color = paint_properties.color;
    float floorwidth = paint_properties.floorwidth;
    float blur = paint_properties.blur;
    float opacity = paint_properties.opacity;
    float gapwidth = paint_properties.gap_width;
    float offset = paint_properties.offset;
    float width = paint_properties.width;
    float border_width = paint_properties.border_width;
    vec4 border_color = paint_properties.border_color;
    float emissive_strength = paint_properties.emissive_strength;

#ifdef VARIABLE_LINE_EMISSIVE_STRENGTH
    emissive_strength = a_z_offset_width.w;
#endif

    v_border_color = border_color;
    v_opacity = opacity;
    v_blur = blur;
    v_floorwidth = floorwidth;
    v_border_width = border_width;
    v_emissive_strength = emissive_strength;

    float a_z_offset = u_z_offset;
#if defined(ELEVATED) || defined(ELEVATED_ROADS)
    a_z_offset += a_z_offset_width.x;
#endif
#ifdef DEBUG_ELEVATION_ID
    v_elevation_id_col = a_elevation_id_col;
#endif

    highp float line_progress = 0.0;
#if defined(RENDER_LINE_GRADIENT) || defined(RENDER_LINE_BORDER_GRADIENT) || defined(RENDER_LINE_TRIM_OFFSET)
    line_progress = a_packed[2];
#endif

    // The distance over which the line edge fades out.
    // Retina devices need a smaller distance to avoid aliasing.
    float ANTIALIASING = 1.0 / u_device_pixel_ratio / 2.0;
#ifndef VARIABLE_LINE_WIDTH
    if (u_has_border) {
        // Increase distance for lines with border to improve distance based
        // anti-aliasing (fwidth-based) of the border edges.
        // The multiplier was determined experimentally to achieve pixel-perfect
        // anti-aliasing of the border for extremely pitched lines near the
        // horizon: lower values cause aliasing on the borders, while higher
        // values yield no further visual improvement.
        ANTIALIASING *= 8.0;
    }
#endif

    vec2 a_extrude = vec2(a_data.xy) - 128.0;
    float a_direction = float(a_data.z & 3u) - 1.0;
    vec2 pos_normal = vec2(a_pos_normal);
    vec2 pos = floor(pos_normal * 0.5);

    // x is 1 if it's a round cap, 0 otherwise
    // y is 1 if the normal points up, and -1 if it points down
    // We store these in the least significant bit of a_pos_normal
    mediump vec2 normal = pos_normal - 2.0 * pos;
    normal.y = normal.y * 2.0 - 1.0;

    v_normal = normal;

    offset = -1.0 * offset * u_width_scale;
    bool left = normal.y == 1.0;

    // these transformations used to be applied in the JS and native code bases.
    // moved them into the shader for clarity and simplicity.
    gapwidth = gapwidth / 2.0;
    float halfwidth;
    float dilute_scale = 1.0;
    float dilute_border_scale = 1.0;
    vec2 side_widths = vec2(0.0);
#ifdef VARIABLE_LINE_WIDTH
    float left_width = a_z_offset_width.y;
    float right_width = a_z_offset_width.z;
    bool zero_right_width = border_width == 0.0 && right_width == 0.0;
    side_widths = u_width_scale * (zero_right_width ? vec2(left_width + u_width_addition) : vec2(left_width, right_width) + 0.5 * u_width_addition);
    halfwidth = left ? side_widths.x : (zero_right_width ? 0.0 : side_widths.y);

    // Variable width is used as an offset for non-zero border_widths case.
    // Then the width of the visible part is defined by border_width.
    offset = border_width > 0.0 ? (left_width + right_width + u_width_addition) * u_width_scale : offset;
    halfwidth = border_width > 0.0 ? border_width * u_width_scale * 0.5 : halfwidth;

    side_widths = border_width > 0.0 ? vec2(halfwidth) : side_widths;

    // If the right width is 0, we are rendering an asymmetric line with a stub side
    // We should disable antialiasing and blur on this side to be able to stich two lines together
    stub_side = zero_right_width ? -normal.y : 0.0;
    v_normal = !left && zero_right_width ? vec2(0.0) : v_normal;
    ANTIALIASING = !left && zero_right_width ? 0.0 : ANTIALIASING;
#else
    halfwidth = (u_width_scale * width) / 2.0;
#endif

    float inset = gapwidth + (gapwidth > 0.0 ? ANTIALIASING : 0.0);
    float outset = gapwidth + halfwidth * (gapwidth > 0.0 ? 2.0 : 1.0) + (halfwidth > 0.0 ? ANTIALIASING : 0.0);
#ifdef VARIABLE_LINE_WIDTH
    v_distance = v_normal * outset;
#endif

    // Scale the extrusion vector down to a normal and then up by the line width
    // of this vertex.
    mediump vec2 dist = outset * a_extrude * EXTRUDE_SCALE;

    // Calculate the offset when drawing a line that is to the side of the actual line.
    // We do this by creating a vector that points towards the extrude, but rotate
    // it when we're drawing round end points (a_direction = -1 or 1) since their
    // extrude vector points in another direction.
    mediump float u = 0.5 * a_direction;
    mediump float t = 1.0 - abs(u);
    mediump vec2 offset2 = offset * a_extrude * EXTRUDE_SCALE * normal.y * mat2(t, -u, u, t);

    float hidden = float(opacity == 0.0);
    vec2 extrude = dist * u_pixels_to_tile_units;
    vec4 projected_extrude = u_matrix * vec4(extrude, 0.0, 0.0);
    vec2 projected_extrude_xy = projected_extrude.xy;

#ifdef ELEVATED_ROADS
    v_road_z_offset = a_z_offset;
    v_tile_pos = pos + offset2 * u_pixels_to_tile_units;
    gl_Position = u_matrix * vec4(v_tile_pos, a_z_offset, 1.0);
#else
#ifdef ELEVATED
    vec2 offsetTile = offset2 * u_pixels_to_tile_units;
    vec2 offset_pos = pos + offsetTile;
    float ele = 0.0;
    float scaled_z_offset = a_z_offset;
#ifdef ELEVATION_GROUND_SCALE
    scaled_z_offset = a_z_offset * mix(1.0, u_exaggeration, a_elevation_ground_scale);
#endif
#ifdef CROSS_SLOPE_VERTICAL
    // Vertical line
    // The least significant bit of a_pos_normal.y hold 1 if it's on top, 0 for bottom
    float top = pos_normal.y - 2.0 * floor(pos_normal.y * 0.5);
    float line_height = 2.0 * u_tile_to_meter * outset * top * u_pixels_to_tile_units[1][1] + scaled_z_offset;
    ele = sample_elevation(offset_pos) + line_height;
    // Ignore projected extrude for vertical lines
    projected_extrude = vec4(0);
#else // CROSS_SLOPE_VERTICAL
#ifdef CROSS_SLOPE_HORIZONTAL
    // Horizontal line
    float ele0 = sample_elevation(offset_pos);
    float ele1 = max(sample_elevation(offset_pos + extrude), sample_elevation(offset_pos + extrude / 2.0));
    float ele2 = max(sample_elevation(offset_pos - extrude), sample_elevation(offset_pos - extrude / 2.0));
    float ele_max = max(ele0, max(ele1, ele2));
    ele = ele_max + scaled_z_offset;
#else // CROSS_SLOPE_HORIZONTAL
    // Line follows terrain slope
    float ele0 = sample_elevation(offset_pos);
    float ele1 = max(sample_elevation(offset_pos + extrude), sample_elevation(offset_pos + extrude / 2.0));
    float ele2 = max(sample_elevation(offset_pos - extrude), sample_elevation(offset_pos - extrude / 2.0));
    float ele_max = max(ele0, 0.5 * (ele1 + ele2));
    ele = ele_max - ele0 + ele1 + scaled_z_offset;
#endif // CROSS_SLOPE_HORIZONTAL
#endif // CROSS_SLOPE_VERTICAL
    v_tile_pos = offset_pos;
    gl_Position = u_matrix * vec4(v_tile_pos, ele, 1.0) + projected_extrude;
    float z = clamp(gl_Position.z / gl_Position.w, 0.5, 1.0);
    float zbias = max(0.00005, (pow(z, 0.8) - z) * u_zbias_factor * u_exaggeration);
    gl_Position.z -= (gl_Position.w * zbias);
    gl_Position = mix(gl_Position, AWAY, hidden);
#else // ELEVATED
    v_tile_pos = pos + offset2 * u_pixels_to_tile_units;
    gl_Position = u_matrix * vec4(v_tile_pos, 0.0, 1.0);
#endif // ELEVATED
#endif // ELEVATED_ROADS

#ifndef ELEVATED
#ifndef VARIABLE_LINE_WIDTH
#ifndef RENDER_TO_TEXTURE
    // Scale up sub-pixel extrusions of inner line width to ensure minimum half-pixel visibility.
    // Only apply when line width >= 1px — lines intentionally styled < 1px should not be diluted.
    float base_w = gl_Position.w;
    vec2 screen_width = abs(projected_extrude.xy / base_w * u_units_to_pixels);
    float max_extrude_component = max(screen_width.x, screen_width.y);
    if (width >= 1.0 && base_w > 0.0 && max_extrude_component > 0.0001) {
        float min_pixel = 1.05; // u_units_to_pixels is [2 / width, 2 / height], not using half pixel for halfwidth here
        if (max_extrude_component < min_pixel) {
            vec2 abs_pos = abs(gl_Position.xy);
            float is_out = max(abs_pos.x, abs_pos.y) / base_w;
            // smoothly disable dilute for a very long lines outside viewport (2.5 -> 4.5)
            // bump width here and reduce opacity in fragment shader by dilute_scale factor
            dilute_scale = mix(max_extrude_component / min_pixel, 1.0, smoothstep(2.5, 4.5, is_out));
            // Scaling z/w too tears the quad at high pitch.
            projected_extrude.xy /= dilute_scale;
            projected_extrude_xy = projected_extrude.xy;
        }
        else if (gapwidth > 0.0) {
            // For case layers (line-gap-width > 0), the visible border is just halfwidth
            // on each side. The overall extrusion is wide due to the gap, but the visible
            // portion can still be sub-pixel and needs dilution to reduce aliasing.
            float visible_ratio = (halfwidth + ANTIALIASING) / outset;
            vec2 visible_screen_width = screen_width * visible_ratio;
            float max_visible_component = max(visible_screen_width.x, visible_screen_width.y);
            dilute_scale = min(1.0, max_visible_component / min_pixel);
            if (!u_has_border) {
            // Must match the coverage filter condition in the fragment shader.
            if (u_has_dash && blur < 0.01 && halfwidth >= ANTIALIASING) {
                dilute_scale = 1.0;
            }
            }
        }
        else
        {
            if (u_has_border) {
                // if line is wide enough, reduce opacity of thin borders only - no change of border width
                float border_ratio = (border_width * u_width_scale + ANTIALIASING) / outset;
                screen_width *= border_ratio;
                float max_border_component = max(screen_width.x, screen_width.y);
                dilute_border_scale = min(1.0, max_border_component / min_pixel);
            }
        }
    }
#endif
#endif
#ifdef VARIABLE_LINE_WIDTH
#ifndef RENDER_TO_TEXTURE
    vec2 ndc = gl_Position.xy / gl_Position.w;
    vec4 projected_tangent = u_matrix * vec4(extrude.y, -extrude.x, 0.0, 0.0);
    vec2 screen_extrude = (projected_extrude.xy - ndc * projected_extrude.w) * u_units_to_pixels;
    vec2 screen_tangent = (projected_tangent.xy - ndc * projected_tangent.w) * u_units_to_pixels;
    float thickness = abs(screen_extrude.x * screen_tangent.y - screen_extrude.y * screen_tangent.x) / max(length(screen_tangent), 1e-6);
    float thickness_px = max(thickness, 0.2 * length(screen_extrude)) / gl_Position.w * u_device_pixel_ratio;
    float headroom_scale = gl_Position.w > 0.0 ? 1.0 + (1.0 - smoothstep(2.0, 4.0, thickness_px)) / max(thickness_px, 0.0001) : 1.0;
    projected_extrude *= headroom_scale;
    extrude *= headroom_scale;
    v_distance *= headroom_scale;
#endif
#endif
    v_tile_pos = (v_tile_pos + extrude) / EXTENT;
#ifdef ELEVATED_ROADS
    gl_Position = gl_Position + projected_extrude;
#ifdef VARIABLE_LINE_WIDTH
#ifndef ELEVATED
    // Depth-only pull toward camera (xy/w unchanged — no world-Z float). Must be the same clip z on
    // every vertex: a per-vertex view-space pull is huge near the camera, and interpolation spreads it
    // along long triangles. Ramped to 0 below -0.5 m so the tunnel seethrough comparison is unshifted
    // (same range as the cutout route lift).
    gl_Position.z -= u_road_view_depth_bias * smoothstep(-0.5, 0.0, a_z_offset);
#endif // ELEVATED
#endif // VARIABLE_LINE_WIDTH
#else
    gl_Position = mix(gl_Position + projected_extrude, AWAY, hidden);
#endif
#endif

#ifdef ELEVATED_ROADS
#ifdef RENDER_SHADOWS
    vec3 shd_pos = vec3(pos + (offset2 + dist) * u_pixels_to_tile_units, a_z_offset);
    vec3 shd_pos0 = shd_pos;
    vec3 shd_pos1 = shd_pos;
#ifdef NORMAL_OFFSET
    vec3 shd_pos_offset = shadow_normal_offset(vec3(0.0, 0.0, 1.0));
    shd_pos0 += shd_pos_offset * shadow_normal_offset_multiplier0();
    shd_pos1 += shd_pos_offset * shadow_normal_offset_multiplier1();
#endif
    v_pos_light_view_0 = u_light_matrix_0 * vec4(shd_pos0, 1);
    v_pos_light_view_1 = u_light_matrix_1 * vec4(shd_pos1, 1);
    v_depth = gl_Position.w;
#endif
#endif

#ifndef RENDER_TO_TEXTURE
    float epsilon = 0.0001;
    // calculate how much the perspective view squishes or stretches the extrude
    float extrude_length_without_perspective = max(length(dist), epsilon);
    float extrude_length_with_perspective = max(length(projected_extrude_xy / gl_Position.w * u_units_to_pixels), epsilon);
    v_gamma_scale = mix(extrude_length_without_perspective / extrude_length_with_perspective, 1.0, step(0.01, blur));
#else
    v_gamma_scale = 1.0;
#endif

#if defined(RENDER_LINE_GRADIENT) || defined(RENDER_LINE_BORDER_GRADIENT) || defined(RENDER_LINE_TRIM_OFFSET)
    highp float a_uv_x = a_packed[0];
    float a_split_index = a_packed[1];
#if defined(RENDER_LINE_GRADIENT) || defined(RENDER_LINE_BORDER_GRADIENT)
    highp float texel_height = 1.0 / u_image_height;
    highp float half_texel_height = 0.5 * texel_height;

    v_uv = vec3(a_uv_x, a_split_index * texel_height - half_texel_height, line_progress);
#else
    v_uv = vec3(a_uv_x, 0.0, line_progress);
#endif
#endif

if (u_has_dash) {
    highp vec4 dashf = paint_properties.dash;
    // highp before /65535: that literal is Inf in mediump/FP16 (e.g. Mali-G71).
    highp float dash_w = dashf.w;
    highp float totalLength = dashf.z + dash_w / 65535.0;
    float scale = totalLength == 0.0 ? 0.0 : u_tile_units_to_pixels / totalLength;

    // Low 4 bits = half-height; high 12 = dash coverage (fragment only). dashf.y is exact here
    // (highp), so bit ops round-trip precisely instead of drifting through mod/floor on a value
    // that can reach 65527.
    highp uint dash_bits = uint(dashf.y + 0.5);
    float dash_half_height = float(dash_bits & 15u);
    float dash_coverage = float(dash_bits >> 4u) / 4095.0;
    v_tex = vec2(a_linesofar * scale / (floorwidth * u_floor_width_scale), (-normal.y * dash_half_height + dashf.x + 0.5) / u_texsize.y);
    v_dash = vec2(totalLength, dash_coverage);
} else {
    v_tex = vec2(0.0);
    v_dash = vec2(0.0);
}

    v_width2_dilute = vec4(outset, inset, dilute_scale, dilute_border_scale);
#ifdef VARIABLE_LINE_WIDTH
    v_width2_dilute.xy = side_widths;
#endif

#ifdef LINE_ROUND_JOIN_CLIP_BORDER_OVERLAP
    // Placed after the dilute section: sub-pixel lines draw at extrude / dilute_scale, so the test
    // position has to follow the vertex that is actually emitted.
    // tileToPixels calculation assumes that gl-native stores uniform scale in u_pixels_to_tile_units.
    // A sheared matrix (gl-js, non-Mercator) would need the full martix inverse and never enables this define.
    highp float tileToPixels = 1.0 / u_pixels_to_tile_units[0][0];
    highp vec2 testPos = pos + extrude / dilute_scale;
    highp vec3 prevA = unpackRoundJoinTestCoordinate(a_round_join_conflict_segments.x);
    highp vec3 prevB = unpackRoundJoinTestCoordinate(a_round_join_conflict_segments.y);
    highp vec3 nextA = unpackRoundJoinTestCoordinate(a_round_join_conflict_segments.z);
    highp vec3 nextB = unpackRoundJoinTestCoordinate(a_round_join_conflict_segments.w);
    v_round_join_conflict_offset = vec4(testPos - prevA.xy, testPos - nextA.xy) * tileToPixels;
    v_round_join_conflict_dir = vec4(prevB.xy - prevA.xy, nextB.xy - nextA.xy) * tileToPixels;
    v_round_join_conflict_test = vec2(prevA.z, nextA.z);
#endif

#ifdef FOG
    v_fog_pos = fog_position(pos);
#endif

#ifdef INDICATOR_CUTOUT
    v_z_offset = a_z_offset;
#endif
}
