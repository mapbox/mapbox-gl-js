attribute vec4 a_pos_offset;
attribute vec2 a_label_pos;
attribute vec4 a_data;

// icon-size data (see symbol_sdf.vertex.glsl for more)
attribute vec3 a_size;
uniform bool u_is_size_zoom_constant;
uniform bool u_is_size_feature_constant;
uniform highp float u_size_t; // used to interpolate between zoom stops when size is a composite function
uniform highp float u_size; // used when size is both zoom and feature constant
uniform highp float u_layout_size; // used when size is feature constant
uniform highp float u_camera_to_center_distance;
uniform highp float u_pitch;
uniform highp float u_collision_y_stretch;

#pragma mapbox: define lowp float opacity

// matrix is for the vertex position.
uniform mat4 u_matrix;

uniform bool u_is_text;
uniform highp float u_zoom;
uniform bool u_rotate_with_map;
uniform vec2 u_extrude_scale;

uniform vec2 u_texsize;

varying vec2 v_tex;
varying vec2 v_fade_tex;

void main() {
    #pragma mapbox: initialize lowp float opacity

    vec2 a_pos = a_pos_offset.xy;
    vec2 a_offset = a_pos_offset.zw;

    vec2 a_tex = a_data.xy;
    highp vec2 label_data = unpack_float(a_data[2]);
    highp float a_labelminzoom = label_data[0];
    highp vec2 a_zoom = unpack_float(a_data[3]);
    highp float a_minzoom = a_zoom[0];
    highp float a_maxzoom = a_zoom[1];

    float size;
    // In order to accommodate placing labels around corners in
    // symbol-placement: line, each glyph in a label could have multiple
    // "quad"s only one of which should be shown at a given zoom level.
    // The min/max zoom assigned to each quad is based on the font size at
    // the vector tile's zoom level, which might be different than at the
    // currently rendered zoom level if text-size is zoom-dependent.
    // Thus, we compensate for this difference by calculating an adjustment
    // based on the scale of rendered text size relative to layout text size.
    highp float layoutSize;
    if (!u_is_size_zoom_constant && !u_is_size_feature_constant) {
        size = mix(a_size[0], a_size[1], u_size_t) / 10.0;
        layoutSize = a_size[2] / 10.0;
    } else if (u_is_size_zoom_constant && !u_is_size_feature_constant) {
        size = a_size[0] / 10.0;
        layoutSize = size;
    } else if (!u_is_size_zoom_constant && u_is_size_feature_constant) {
        size = u_size;
        layoutSize = u_layout_size;
    } else {
        size = u_size;
        layoutSize = u_size;
    }

    float fontScale = u_is_text ? size / 24.0 : size;

    highp float zoomAdjust = log2(size / layoutSize);
    highp float adjustedZoom = (u_zoom - zoomAdjust) * 10.0;
    // result: z = 0 if a_minzoom <= adjustedZoom < a_maxzoom, and 1 otherwise
    highp float z = 2.0 - step(a_minzoom, adjustedZoom) - (1.0 - step(a_maxzoom, adjustedZoom));

    vec4 projectedPoint = u_matrix * vec4(a_label_pos, 0, 1);
    highp float camera_to_anchor_distance = projectedPoint.w;
    highp float perspective_ratio = 1.0 + 0.5*((camera_to_anchor_distance / u_camera_to_center_distance) - 1.0);

    vec2 extrude = fontScale * u_extrude_scale * perspective_ratio * (a_offset / 64.0);
    if (u_rotate_with_map) {
        gl_Position = u_matrix * vec4(a_pos + extrude, 0, 1);
        gl_Position.z += z * gl_Position.w;
    } else {
        gl_Position = u_matrix * vec4(a_pos, 0, 1) + vec4(extrude, 0, 0);
    }

    v_tex = a_tex / u_texsize;
    // See comments in symbol_sdf.vertex
    highp float incidence_stretch  = camera_to_anchor_distance / (u_camera_to_center_distance * cos(u_pitch));
    highp float collision_adjustment = max(1.0, incidence_stretch / u_collision_y_stretch);

    highp float perspective_zoom_adjust = log2(perspective_ratio * collision_adjustment) * 10.0;
    v_fade_tex = vec2((a_labelminzoom + perspective_zoom_adjust) / 255.0, 0.0);
}
