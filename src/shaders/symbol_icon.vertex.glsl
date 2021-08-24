attribute vec4 a_pos_offset;
attribute vec4 a_tex_size;
attribute vec4 a_pixeloffset;
attribute vec4 a_z_tile_anchor;
attribute vec3 a_projected_pos;
attribute float a_fade_opacity;

uniform bool u_is_size_zoom_constant;
uniform bool u_is_size_feature_constant;
uniform highp float u_size_t; // used to interpolate between zoom stops when size is a composite function
uniform highp float u_size; // used when size is both zoom and feature constant
uniform highp float u_camera_to_center_distance;
uniform highp float u_pitch;
uniform bool u_rotate_symbol;
uniform highp float u_aspect_ratio;
uniform float u_fade_change;

uniform mat4 u_matrix;
uniform mat4 u_label_plane_matrix;
uniform mat4 u_coord_matrix;

uniform bool u_is_text;
uniform bool u_pitch_with_map;

uniform vec2 u_texsize;

varying vec2 v_tex;
varying float v_fade_opacity;

#pragma mapbox: define lowp float opacity

void main() {
    #pragma mapbox: initialize lowp float opacity

    vec2 a_pos = a_pos_offset.xy;
    vec2 a_offset = a_pos_offset.zw;

    vec2 a_tex = a_tex_size.xy;
    vec2 a_size = a_tex_size.zw;

    float a_size_min = floor(a_size[0] * 0.5);
    vec2 a_pxoffset = a_pixeloffset.xy;
    vec2 a_minFontScale = a_pixeloffset.zw / 256.0;

    highp float segment_angle = -a_projected_pos[2];
    float size;

    if (!u_is_size_zoom_constant && !u_is_size_feature_constant) {
        size = mix(a_size_min, a_size[1], u_size_t) / 128.0;
    } else if (u_is_size_zoom_constant && !u_is_size_feature_constant) {
        size = a_size_min / 128.0;
    } else {
        size = u_size;
    }

    float anchorZ = a_z_tile_anchor.x;
    vec2 tileAnchor = a_z_tile_anchor.yz;
    vec3 h = elevationVector(tileAnchor) * elevation(tileAnchor);
    vec4 projectedPoint = u_matrix * vec4(vec3(a_pos, anchorZ) + h, 1);

    highp float camera_to_anchor_distance = projectedPoint.w;
    // See comments in symbol_sdf.vertex
    highp float distance_ratio = u_pitch_with_map ?
        camera_to_anchor_distance / u_camera_to_center_distance :
        u_camera_to_center_distance / camera_to_anchor_distance;
    highp float perspective_ratio = clamp(
            0.5 + 0.5 * distance_ratio,
            0.0, // Prevents oversized near-field symbols in pitched/overzoomed tiles
            1.5);

    size *= perspective_ratio;

    float fontScale = u_is_text ? size / 24.0 : size;

    highp float symbol_rotation = 0.0;
    if (u_rotate_symbol) {
        // See comments in symbol_sdf.vertex
        vec4 offsetProjectedPoint = u_matrix * vec4(a_pos + vec2(1, 0), anchorZ, 1);

        vec2 a = projectedPoint.xy / projectedPoint.w;
        vec2 b = offsetProjectedPoint.xy / offsetProjectedPoint.w;

        symbol_rotation = atan((b.y - a.y) / u_aspect_ratio, b.x - a.x);
    }

#ifdef PROJECTED_POS_ON_VIEWPORT
    vec4 projected_pos = u_label_plane_matrix * vec4(a_projected_pos.xy, 0.0, 1.0);
#else
    vec4 projected_pos = u_label_plane_matrix * vec4(vec3(a_projected_pos.xy, anchorZ) + h, 1.0);
#endif

    highp float angle_sin = sin(segment_angle + symbol_rotation);
    highp float angle_cos = cos(segment_angle + symbol_rotation);
    mat2 rotation_matrix = mat2(angle_cos, -1.0 * angle_sin, angle_sin, angle_cos);

    float z = 0.0;
    vec2 offset = rotation_matrix * (a_offset / 32.0 * max(a_minFontScale, fontScale) + a_pxoffset / 16.0);
#ifdef PITCH_WITH_MAP_TERRAIN
    vec4 tile_pos = u_label_plane_matrix_inv * vec4(a_projected_pos.xy + offset, 0.0, 1.0);
    z = elevation(tile_pos.xy);
#endif
    // Symbols might end up being behind the camera. Move them AWAY.
    float occlusion_fade = occlusionFade(projectedPoint);
    gl_Position = mix(u_coord_matrix * vec4(projected_pos.xy / projected_pos.w + offset, z, 1.0), AWAY, float(projectedPoint.w <= 0.0 || occlusion_fade == 0.0));

    v_tex = a_tex / u_texsize;
    vec2 fade_opacity = unpack_opacity(a_fade_opacity);
    float fade_change = fade_opacity[1] > 0.5 ? u_fade_change : -u_fade_change;
    v_fade_opacity = max(0.0, min(occlusion_fade, fade_opacity[0] + fade_change));
}
