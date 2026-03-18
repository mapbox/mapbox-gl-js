#include "_prelude_terrain.vertex.glsl"
#include "_prelude_shadow.vertex.glsl"

#define USING_APPEARANCE 1.0

in ivec4 a_pos_offset;
in uvec4 a_tex_size;
in ivec4 a_pixeloffset;
in vec4 a_projected_pos;
in uint a_fade_opacity;

#ifdef Z_OFFSET
in float a_auto_z_offset;
#endif
#ifdef PROJECTION_GLOBE_VIEW
in ivec4 a_globe_anchor;
in vec3 a_globe_normal;
#endif

#ifdef ICON_TRANSITION
in uvec2 a_texb;
#endif

#ifdef OCCLUSION_QUERIES
in float a_occlusion_query_opacity;
#endif

#ifdef ELEVATED_ROADS
in vec3 a_x_axis;
in vec3 a_y_axis;

uniform float u_normal_scale;
#endif

#ifdef INDICATOR_CUTOUT
out highp float v_z_offset;
#else
#ifdef RENDER_SHADOWS
out highp float v_z_offset;
#endif
#endif

// contents of a_size vary based on the type of property value
// used for {text,icon}-size.
// For constants, a_size is disabled.
// For source functions, we bind only one value per vertex: the value of {text,icon}-size evaluated for the current feature.
// For composite functions:
// [ text-size(lowerZoomStop, feature),
//   text-size(upperZoomStop, feature) ]
uniform bool u_is_size_zoom_constant;
uniform bool u_is_size_feature_constant;
uniform highp float u_size_t; // used to interpolate between zoom stops when size is a composite function
uniform highp float u_size; // used when size is both zoom and feature constant
uniform mat4 u_matrix;
uniform mat4 u_inv_matrix;
uniform mat4 u_label_plane_matrix;
uniform mat4 u_coord_matrix;
uniform bool u_is_text;
uniform bool u_elevation_from_sea;
uniform bool u_pitch_with_map;
uniform bool u_rotate_symbol;
uniform highp float u_aspect_ratio;
uniform highp float u_camera_to_center_distance;
uniform float u_fade_change;
uniform vec2 u_texsize;
uniform vec3 u_up_vector;
uniform vec2 u_texsize_icon;
uniform bool u_is_halo;

#ifdef PROJECTION_GLOBE_VIEW
uniform vec3 u_tile_id;
uniform mat4 u_inv_rot_matrix;
uniform vec2 u_merc_center;
uniform vec3 u_camera_forward;
uniform float u_zoom_transition;
uniform vec3 u_ecef_origin;
uniform mat4 u_tile_matrix;
#endif

out vec2 v_tex_a;
#ifdef ICON_TRANSITION
out vec2 v_tex_b;
#endif

out float v_draw_halo;
out vec3 v_gamma_scale_size_fade_opacity;
#ifdef RENDER_TEXT_AND_SYMBOL
out float is_sdf;
out vec2 v_tex_a_icon;
#endif

#ifdef RENDER_SHADOWS
uniform mat4 u_light_matrix_0;
uniform mat4 u_light_matrix_1;

out highp vec4 v_pos_light_view_0;
out highp vec4 v_pos_light_view_1;
out highp float v_depth;
#endif

#ifdef USE_PAINT_PROPERTIES_UBO
/// UBO-based paint property declarations.

/// Maximum size of UBO (uniform buffer object).
///
/// Specs guarantees a minimum of 16KB, but some devices support larger UBOs,
/// and this value can be set at runtime based on device capabilities.
#ifndef MAX_UBO_SIZE_VEC4
#define MAX_UBO_SIZE_VEC4 1024u
#endif

/// Symbol paint properties header size (in vec4 units).
///
/// Header size is determined by the number of properties and the information we need to
/// store for each property.
#define SPP_HEADER_SIZE_VEC4 3u

#define DWORDS_PER_VEC4 4u

/// Paint properties for a symbol layer.
struct SymbolPaintProperties {
    /// Non-premultiplied render fill color.
    vec4 fill_np_color;
    /// Non-premultiplied render halo color.
    vec4 halo_np_color;
    float opacity;
    float halo_width;
    float halo_blur;
    float emissive_strength;
    float occlusion_opacity;
    float z_offset;
    /// Per-feature translate in label-plane (viewport pixel) units, before anchor rotation.
    /// Rotated by u_spp_translate_rotation and added to pos before u_coord_matrix multiply.
    vec2 translate;
};

struct PropertyType {
    /// Whether the property is data-driven and has value in data-driven block or constant uniform.
    bool isDataDriven;
     /// Whether the property is zoom-dependent and has two values that need to be interpolated between zooms.
    bool isZoomDependent;
    /// Local offset within the data-driven block (in dwords).
    ///
    /// Offset should be aligned to the property size:
    /// - vec2 for encoded color
    /// - vec4 for two packed colors (used for zoom-dependent color properties)
    /// - float for float properties
    /// - vec2 for two floats properties (used for zoom-dependent float properties)
    uint offsetDwords;
};

struct SymbolPropertyHeader {
    /// Size of a data-driven block (in vec4 units).
    ///
    /// Size of the data-driven block should be aligned to vec4.
    uint dataDrivenBlockSizeVec4;
    /// Property types and aligned block offsets for each property.
    PropertyType fill_np_color;
    PropertyType halo_np_color;
    PropertyType opacity;
    PropertyType halo_width;
    PropertyType halo_blur;
    PropertyType emissive_strength;
    PropertyType occlusion_opacity;
    PropertyType z_offset;
    /// GL JS-specific: per-feature translate (vec2, uses previously-unused h[2][3] slot).
    PropertyType translate;
};

/// Zoom interpolation factor for zoom-dependent paint properties.
uniform float u_zoom;

/// Constant paint properties values shared for all features.
///
/// Note: "spp" prefix (Symbol Paint Properties) is needed to avoid name conflicts
/// with pragma-based paint property declarations.
uniform lowp vec4 u_spp_fill_np_color;
uniform lowp vec4 u_spp_halo_np_color;
uniform lowp float u_spp_opacity;
uniform lowp float u_spp_halo_width;
uniform lowp float u_spp_halo_blur;
uniform lowp float u_spp_emissive_strength;
uniform lowp float u_spp_occlusion_opacity;
uniform lowp float u_spp_z_offset;
/// [cos(angle), sin(angle)] for translate-anchor rotation; [1,0] = no rotation (viewport anchor).
uniform lowp vec2 u_spp_translate_rotation;

/// Per-feature index used to look up the feature's data-driven paint property block in
/// the u_properties uniform buffer.
in float a_feature_index;

layout(std140) uniform SymbolPaintPropertiesHeaderUniform {
    /// Header contains information about the following:
    /// - Mask for which properties are data-driven (32-bit bitmask, 1 bit per property)
    /// - Mask for which properties are zoom-dependent (32-bit bitmask, 1 bit per property)
    /// - Size of a data-driven single block
    /// - Offsets for each property in a data-driven block
    uvec4 header[SPP_HEADER_SIZE_VEC4];
} u_spp_header;

layout(std140) uniform SymbolPaintPropertiesUniform {
    /// Buffer contains vec4 aligned data-driven blocks (a single block per feature,
    /// multiple blocks for multiple features).
    vec4 properties[MAX_UBO_SIZE_VEC4];
} u_spp_properties;

layout(std140) uniform SymbolPaintPropertiesIndexUniform {
    /// Maps each feature index to its corresponding data-driven block index within
    /// the u_properties uniform buffer.
    uvec4 block_indices[MAX_UBO_SIZE_VEC4];
} u_spp_index;

/// Symbol paint properties need to be interpolated and passed to the fragment shader.
out lowp float v_opacity;
#ifdef RENDER_SDF
out lowp vec4 v_fill_np_color;
out lowp vec4 v_halo_np_color;
out lowp float v_halo_width;
out lowp float v_halo_blur;
#endif
#ifdef LIGHTING_3D_MODE
out lowp float v_emissive_strength;
#endif

PropertyType getPropertyType(uint propertyIndex, uint dataDrivenMask, uint zoomDependentMask, uint offsetDwords) {
    PropertyType type;
    type.isDataDriven = (dataDrivenMask & (1u << propertyIndex)) != 0u;
    type.isZoomDependent = (zoomDependentMask & (1u << propertyIndex)) != 0u;
    type.offsetDwords = offsetDwords;
    return type;
}

SymbolPropertyHeader readSymbolPropertiesHeader() {
    SymbolPropertyHeader header;
    // Read masks:
    uint dataDrivenMask = u_spp_header.header[0][0];
    uint zoomDependentMask = u_spp_header.header[0][1];
    // Read block sizes:
    header.dataDrivenBlockSizeVec4 = u_spp_header.header[0][2];
    // Read property types and block offsets:
    header.fill_np_color        = getPropertyType(0u, dataDrivenMask, zoomDependentMask, u_spp_header.header[0][3]);
    header.halo_np_color        = getPropertyType(1u, dataDrivenMask, zoomDependentMask, u_spp_header.header[1][0]);
    header.opacity              = getPropertyType(2u, dataDrivenMask, zoomDependentMask, u_spp_header.header[1][1]);
    header.halo_width           = getPropertyType(3u, dataDrivenMask, zoomDependentMask, u_spp_header.header[1][2]);
    header.halo_blur            = getPropertyType(4u, dataDrivenMask, zoomDependentMask, u_spp_header.header[1][3]);
    header.emissive_strength    = getPropertyType(5u, dataDrivenMask, zoomDependentMask, u_spp_header.header[2][0]);
    header.occlusion_opacity    = getPropertyType(6u, dataDrivenMask, zoomDependentMask, u_spp_header.header[2][1]);
    header.z_offset             = getPropertyType(7u, dataDrivenMask, zoomDependentMask, u_spp_header.header[2][2]);
    header.translate            = getPropertyType(8u, dataDrivenMask, zoomDependentMask, u_spp_header.header[2][3]);
    return header;
}

/// Returns the component of a uvec4 at the given index.
///
/// Implemented with explicit swizzles to avoid old Adreno driver bugs with
/// dynamic vector component indexing.
uint uvec4At(uvec4 v, uint index) {
    return (index == 0u) ? v.x :
           (index == 1u) ? v.y :
           (index == 2u) ? v.z : v.w;
}

/// Returns the component of a vec4 at the given index.
///
/// Implemented with explicit swizzles to avoid old Adreno driver bugs with
/// dynamic vector component indexing.
float vec4At(vec4 v, uint index) {
    return (index == 0u) ? v.x :
           (index == 1u) ? v.y :
           (index == 2u) ? v.z : v.w;
}

vec4 readVec4(uint baseOffsetVec4, uint propertyOffsetDwords) {
    return u_spp_properties.properties[baseOffsetVec4 + propertyOffsetDwords / DWORDS_PER_VEC4];
}

float readFloat(vec4 slot, uint propertyOffsetDwords) {
    return slot[propertyOffsetDwords % DWORDS_PER_VEC4];
}

uint readUint(uvec4 slot, uint offset) {
    return slot[offset % DWORDS_PER_VEC4];
}

vec2 readVec2(vec4 slot, uint propertyOffsetDwords) {
    float x = vec4At(slot, propertyOffsetDwords % DWORDS_PER_VEC4);
    float y = vec4At(slot, propertyOffsetDwords % DWORDS_PER_VEC4 + 1u);
    return vec2(x, y);
}

/// Calculate the feature's data-driven block offset in u_properties uniform buffer (vec4-indexed).
uint getDataDrivenBlockOffsetVec4(uint dataDrivenBlockSizeVec4) {
    uint featureIndex = uint(a_feature_index);
    uvec4 slot = u_spp_index.block_indices[featureIndex / DWORDS_PER_VEC4];
    uint blockIndex = uvec4At(slot, featureIndex % DWORDS_PER_VEC4);
    return blockIndex * dataDrivenBlockSizeVec4;
}

vec4 readColorProperty(PropertyType propertyType, uint dataDrivenBlockSizeVec4) {
    uint blockOffsetVec4 = getDataDrivenBlockOffsetVec4(dataDrivenBlockSizeVec4);
    vec4 color = readVec4(blockOffsetVec4, propertyType.offsetDwords);
    if (propertyType.isZoomDependent) {
        color = unpack_mix_color(color, u_zoom);
    } else {
        vec2 packedColor = readVec2(color, propertyType.offsetDwords);
        color = decode_color(packedColor);
    }
    return color;
}

/// Read a vec2 property (translate) from the UBO.
/// Non-zoom: 2 consecutive floats [tx, ty] within the same vec4 (offset%4 <= 2).
/// Zoom-dep: 4 floats [tx_min, ty_min, tx_max, ty_max] at a vec4-aligned offset.
vec2 readVec2Property(PropertyType propertyType, uint dataDrivenBlockSizeVec4) {
    uint blockOffsetVec4 = getDataDrivenBlockOffsetVec4(dataDrivenBlockSizeVec4);
    vec4 slot = readVec4(blockOffsetVec4, propertyType.offsetDwords);
    if (propertyType.isZoomDependent) {
        vec2 minVal = slot.xy;
        vec2 maxVal = slot.zw;
        return mix(minVal, maxVal, u_zoom);
    }
    return readVec2(slot, propertyType.offsetDwords);
}

float readFloatProperty(PropertyType propertyType, uint dataDrivenBlockSizeVec4) {
    uint blockOffsetVec4 = getDataDrivenBlockOffsetVec4(dataDrivenBlockSizeVec4);
    vec4 slot = readVec4(blockOffsetVec4, propertyType.offsetDwords);
    float value;
    if (propertyType.isZoomDependent) {
        vec2 packedValues = readVec2(slot, propertyType.offsetDwords);
        value = unpack_mix_vec2(packedValues, u_zoom);
    } else {
        value = readFloat(slot, propertyType.offsetDwords);
    }
    return value;
}

SymbolPaintProperties readSymbolPaintProperties() {
    SymbolPropertyHeader header = readSymbolPropertiesHeader();
    uint sizeVec4 = header.dataDrivenBlockSizeVec4;
    SymbolPaintProperties props;
    props.fill_np_color        = header.fill_np_color.isDataDriven     ? readColorProperty(header.fill_np_color, sizeVec4)     : u_spp_fill_np_color;
    props.halo_np_color        = header.halo_np_color.isDataDriven     ? readColorProperty(header.halo_np_color, sizeVec4)     : u_spp_halo_np_color;
    props.opacity              = header.opacity.isDataDriven           ? readFloatProperty(header.opacity, sizeVec4)           : u_spp_opacity;
    props.halo_width           = header.halo_width.isDataDriven        ? readFloatProperty(header.halo_width, sizeVec4)        : u_spp_halo_width;
    props.halo_blur            = header.halo_blur.isDataDriven         ? readFloatProperty(header.halo_blur, sizeVec4)         : u_spp_halo_blur;
    props.emissive_strength    = header.emissive_strength.isDataDriven ? readFloatProperty(header.emissive_strength, sizeVec4) : u_spp_emissive_strength;
    props.occlusion_opacity    = header.occlusion_opacity.isDataDriven ? readFloatProperty(header.occlusion_opacity, sizeVec4) : u_spp_occlusion_opacity;
    props.z_offset             = header.z_offset.isDataDriven          ? readFloatProperty(header.z_offset, sizeVec4)          : u_spp_z_offset;
    props.translate            = header.translate.isDataDriven          ? readVec2Property(header.translate, sizeVec4)           : vec2(0.0);
    return props;
}

#else 
/// Pragma-based paint property declarations.

#pragma mapbox: define highp vec4 fill_color
#pragma mapbox: define highp vec4 halo_color
#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp float halo_width
#pragma mapbox: define lowp float halo_blur
#pragma mapbox: define lowp float emissive_strength
#pragma mapbox: define lowp float occlusion_opacity
#pragma mapbox: define lowp float z_offset

#endif // USE_PAINT_PROPERTIES_UBO

vec2 unpack_opacity(uint packedOpacity) {
    return vec2(float(packedOpacity / 2u) / 127.0, float(packedOpacity & 1u));
}

void main() {

#ifdef USE_PAINT_PROPERTIES_UBO
    /// UBO-based paint property initializations.

    SymbolPaintProperties paint_properties = readSymbolPaintProperties();
    lowp float opacity = paint_properties.opacity;
    v_opacity = opacity;
#ifdef RENDER_SDF
    v_fill_np_color = paint_properties.fill_np_color;
    v_halo_np_color = paint_properties.halo_np_color;
    v_halo_width = paint_properties.halo_width;
    v_halo_blur = paint_properties.halo_blur;
#endif
#ifdef LIGHTING_3D_MODE
    v_emissive_strength = paint_properties.emissive_strength;
#endif
    lowp float occlusion_opacity = paint_properties.occlusion_opacity;
    lowp float z_offset = paint_properties.z_offset;

#else
    /// Pragma-based paint property initializations.

    #pragma mapbox: initialize highp vec4 fill_color
    #pragma mapbox: initialize highp vec4 halo_color
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize lowp float halo_width
    #pragma mapbox: initialize lowp float halo_blur
    #pragma mapbox: initialize lowp float emissive_strength
    #pragma mapbox: initialize lowp float occlusion_opacity
    #pragma mapbox: initialize lowp float z_offset

#endif // USE_PAINT_PROPERTIES_UBO

    vec2 a_pos = vec2(a_pos_offset.xy);
    vec2 a_offset = vec2(a_pos_offset.zw);

    vec2 a_tex = vec2(a_tex_size.xy);
    vec2 a_size = vec2(a_tex_size.zw);

    float a_size_min = floor(a_size[0] * 0.5);
    float a_size_max =  floor(a_size[1] * 0.5);
    float a_apperance = a_size[1] - 2.0 * a_size_max;
    vec2 a_pxoffset = vec2(a_pixeloffset.xy);
    vec2 a_min_font_scale = vec2(a_pixeloffset.zw) / 256.0;

    highp float segment_angle = -a_projected_pos[3];
    float size;

    // When rendering appearances, we use a_size_max to store the size
    if (a_apperance == USING_APPEARANCE) {
        size = a_size_max / 128.0;
    } else if (!u_is_size_zoom_constant && !u_is_size_feature_constant) {
        size = mix(a_size_min, a_size_max, u_size_t) / 128.0;
    } else if (u_is_size_zoom_constant && !u_is_size_feature_constant) {
        size = a_size_min / 128.0;
    } else {
        size = u_size;
    }

    vec2 tile_anchor = a_pos;
    float e = u_elevation_from_sea ? z_offset : z_offset + elevation(tile_anchor);
#ifdef Z_OFFSET
    e += a_auto_z_offset;
#endif

    vec3 h = elevationVector(tile_anchor) * e;

    float globe_occlusion_fade;
    vec3 world_pos;
    vec3 mercator_pos;
    vec3 world_pos_globe;
#ifdef PROJECTION_GLOBE_VIEW
    mercator_pos = mercator_tile_position(u_inv_rot_matrix, tile_anchor, u_tile_id, u_merc_center);
    world_pos_globe = vec3(a_globe_anchor) + h;
    world_pos = mix_globe_mercator(world_pos_globe, mercator_pos, u_zoom_transition);

    vec4 ecef_point = u_tile_matrix * vec4(world_pos, 1.0);
    vec3 origin_to_point = ecef_point.xyz - u_ecef_origin;

    // Occlude symbols that are on the non-visible side of the globe sphere
    globe_occlusion_fade = dot(origin_to_point, u_camera_forward) >= 0.0 ? 0.0 : 1.0;
#else
    world_pos = vec3(tile_anchor, 0) + h;
    globe_occlusion_fade = 1.0;
#endif

    vec4 projected_point = u_matrix * vec4(world_pos, 1);

    highp float camera_to_anchor_distance = projected_point.w;
    // If the label is pitched with the map, layout is done in pitched space,
    // which makes labels in the distance smaller relative to viewport space.
    // We counteract part of that effect by multiplying by the perspective ratio.
    // If the label isn't pitched with the map, we do layout in viewport space,
    // which makes labels in the distance larger relative to the features around
    // them. We counteract part of that effect by dividing by the perspective ratio.
    highp float distance_ratio = u_pitch_with_map ?
        camera_to_anchor_distance / u_camera_to_center_distance :
        u_camera_to_center_distance / camera_to_anchor_distance;
    highp float perspective_ratio = clamp(
        0.5 + 0.5 * distance_ratio,
        0.0, // Prevents oversized near-field symbols in pitched/overzoomed tiles
        1.5);

    size *= perspective_ratio;

    float font_scale = u_is_text ? size / 24.0 : size;

    highp float symbol_rotation = 0.0;
    if (u_rotate_symbol) {
        // Point labels with 'rotation-alignment: map' are horizontal with respect to tile units
        // To figure out that angle in projected space, we draw a short horizontal line in tile
        // space, project it, and measure its angle in projected space.
        vec4 offsetprojected_point;
        vec2 a;
#ifdef PROJECTION_GLOBE_VIEW
        // Use x-axis of the label plane for displacement (x_axis = cross(normal, vec3(0, -1, 0)))
        vec3 displacement = vec3(a_globe_normal.z, 0, -a_globe_normal.x);
        offsetprojected_point = u_matrix * vec4(vec3(a_globe_anchor) + displacement, 1);
        vec4 projected_point_globe = u_matrix * vec4(world_pos_globe, 1);
        a = projected_point_globe.xy / projected_point_globe.w;
#else
        offsetprojected_point = u_matrix * vec4(tile_anchor + vec2(1, 0), 0, 1);
        a = projected_point.xy / projected_point.w;
#endif
        vec2 b = offsetprojected_point.xy / offsetprojected_point.w;

        symbol_rotation = atan((b.y - a.y) / u_aspect_ratio, b.x - a.x);
    }

    vec4 projected_pos;
#ifdef PROJECTION_GLOBE_VIEW
#ifdef PROJECTED_POS_ON_VIEWPORT
    projected_pos = u_label_plane_matrix * vec4(a_projected_pos.xyz + h, 1.0);
#else
    vec3 proj_pos = mix_globe_mercator(a_projected_pos.xyz, mercator_pos, u_zoom_transition) + h;
    projected_pos = u_label_plane_matrix * vec4(proj_pos, 1.0);    
#endif
#else
    projected_pos = u_label_plane_matrix * vec4(a_projected_pos.xy, h.z, 1.0);
#endif

    highp float angle_sin = sin(segment_angle + symbol_rotation);
    highp float angle_cos = cos(segment_angle + symbol_rotation);
    mat2 rotation_matrix = mat2(angle_cos, -1.0 * angle_sin, angle_sin, angle_cos);

    float z = 0.0;
    vec2 offset = rotation_matrix * (a_offset / 32.0 * max(a_min_font_scale, font_scale) + a_pxoffset / 16.0);
#ifdef TERRAIN
#ifdef PITCH_WITH_MAP_TERRAIN
    vec4 tile_pos = u_label_plane_matrix_inv * vec4(a_projected_pos.xy + offset, 0.0, 1.0);
    z = elevation(tile_pos.xy);
#endif
#endif

#ifdef Z_OFFSET
    z += u_pitch_with_map ? a_auto_z_offset + z_offset : 0.0;
#else
    z += u_pitch_with_map ? z_offset : 0.0;
#endif

    // Symbols might end up being behind the camera. Move them AWAY.
    float occlusion_fade = globe_occlusion_fade;

    vec2 fade_opacity = unpack_opacity(a_fade_opacity);
    float fade_change = fade_opacity[1] > 0.5 ? u_fade_change : -u_fade_change;
    float out_fade_opacity = max(0.0, min(occlusion_fade, fade_opacity[0] + fade_change));

#ifdef DEPTH_OCCLUSION
    float depth_occlusion = occlusionFadeMultiSample(projected_point);
    float depth_occlusion_multplier = mix(occlusion_opacity, 1.0, depth_occlusion);
    out_fade_opacity *= depth_occlusion_multplier;
#endif

#ifdef OCCLUSION_QUERIES
    float occludedFadeMultiplier = mix(occlusion_opacity, 1.0, a_occlusion_query_opacity);
    out_fade_opacity *= occludedFadeMultiplier;
#endif

#ifdef Z_TEST_OCCLUSION
    out_fade_opacity *= occlusion_opacity;
#endif

    float alpha = opacity * out_fade_opacity;
    float hidden = float(alpha == 0.0 || projected_point.w <= 0.0 || occlusion_fade == 0.0);

    vec3 pos;
#ifdef PROJECTION_GLOBE_VIEW
    // Map aligned labels in globe view are aligned to the surface of the globe
    vec3 xAxis = u_pitch_with_map ? normalize(cross(a_globe_normal, u_up_vector)) : vec3(1, 0, 0);
    vec3 yAxis = u_pitch_with_map ? normalize(cross(a_globe_normal, xAxis)) : vec3(0, 1, 0);

    pos = projected_pos.xyz / projected_pos.w + xAxis * offset.x + yAxis * offset.y;
#else
#ifdef ELEVATED_ROADS
    vec3 xAxis = vec3(a_x_axis.xy, a_x_axis.z * u_normal_scale);
    vec3 yAxis = vec3(a_y_axis.xy, a_y_axis.z * u_normal_scale);

    pos = projected_pos.xyz / projected_pos.w + xAxis * offset.x + yAxis * offset.y;
#else // ELEVATED_ROADS
    pos = vec3(projected_pos.xy / projected_pos.w + offset, z);
#endif // ELEVATED_ROADS
#endif
    gl_Position = mix(u_coord_matrix * vec4(pos, 1.0), AWAY, hidden);

#ifdef USE_PAINT_PROPERTIES_UBO
    // Apply per-feature translate (in label-plane / viewport-pixel units).
    // Rotate by u_spp_translate_rotation to handle translate-anchor (identity for viewport anchor).
    // Adding (u_coord_matrix * vec4(rotated_tr, 0, 0)).xy to gl_Position is equivalent to
    // shifting pos.xy by rotated_tr before the u_coord_matrix multiply.
    {
        vec2 tr = paint_properties.translate;
        vec2 rotated_tr = vec2(
            u_spp_translate_rotation.x * tr.x - u_spp_translate_rotation.y * tr.y,
            u_spp_translate_rotation.y * tr.x + u_spp_translate_rotation.x * tr.y
        );
        gl_Position.xy += (u_coord_matrix * vec4(rotated_tr, 0.0, 0.0)).xy;
    }
#endif

    float gamma_scale = gl_Position.w;

    // Cast to float is required to fix a rendering error in Swiftshader
    v_draw_halo = (u_is_halo && float(gl_InstanceID) == 0.0) ? 1.0 : 0.0;

    v_gamma_scale_size_fade_opacity = vec3(gamma_scale, size, out_fade_opacity);
    v_tex_a = a_tex / u_texsize;
#ifdef RENDER_TEXT_AND_SYMBOL
    is_sdf = a_size[0] - 2.0 * a_size_min;
    v_tex_a_icon = a_tex / u_texsize_icon;
#endif
#ifdef ICON_TRANSITION
    v_tex_b = vec2(a_texb) / u_texsize;
#endif

#ifdef RENDER_SHADOWS
    vec4 shd_pos = u_inv_matrix * vec4(pos, 1.0);
    vec3 shd_pos0 = shd_pos.xyz;
    vec3 shd_pos1 = shd_pos.xyz;
#ifdef NORMAL_OFFSET
    vec3 shd_pos_offset = shadow_normal_offset(vec3(0.0, 0.0, 1.0));
    shd_pos0 += shd_pos_offset * shadow_normal_offset_multiplier0();
    shd_pos1 += shd_pos_offset * shadow_normal_offset_multiplier1();
#endif
    v_pos_light_view_0 = u_light_matrix_0 * vec4(shd_pos0, 1);
    v_pos_light_view_1 = u_light_matrix_1 * vec4(shd_pos1, 1);
    v_depth = gl_Position.w;
#endif

#ifdef INDICATOR_CUTOUT
    v_z_offset = e;
#else
#ifdef RENDER_SHADOWS
    v_z_offset = e;
#endif
#endif
}