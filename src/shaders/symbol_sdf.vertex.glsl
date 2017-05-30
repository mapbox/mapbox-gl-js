attribute vec4 a_pos_offset;
attribute vec4 a_data;
attribute vec4 a_projected_pos;

// contents of a_size vary based on the type of property value
// used for {text,icon}-size.
// For constants, a_size is disabled.
// For source functions, we bind only one value per vertex: the value of {text,icon}-size evaluated for the current feature.
// For composite functions:
// [ text-size(lowerZoomStop, feature),
//   text-size(upperZoomStop, feature),
//   layoutSize == text-size(layoutZoomLevel, feature) ]
attribute vec3 a_size;
uniform bool u_is_size_zoom_constant;
uniform bool u_is_size_feature_constant;
uniform mediump float u_size_t; // used to interpolate between zoom stops when size is a composite function
uniform mediump float u_size; // used when size is both zoom and feature constant
uniform mediump float u_layout_size; // used when size is feature constant

#pragma mapbox: define highp vec4 fill_color
#pragma mapbox: define highp vec4 halo_color
#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp float halo_width
#pragma mapbox: define lowp float halo_blur

// matrix is for the vertex position.
uniform mat4 u_matrix;

uniform bool u_is_text;
uniform mediump float u_zoom;

uniform vec2 u_texsize;

varying vec2 v_tex;
varying vec2 v_fade_tex;
varying float v_gamma_scale;
varying float v_size;

void main() {
    #pragma mapbox: initialize highp vec4 fill_color
    #pragma mapbox: initialize highp vec4 halo_color
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize lowp float halo_width
    #pragma mapbox: initialize lowp float halo_blur

    vec2 a_pos = a_pos_offset.xy;
    vec2 a_offset = a_pos_offset.zw;

    vec2 a_tex = a_data.xy;

    mediump vec2 label_data = unpack_float(a_data[2]);
    mediump float a_labelminzoom = label_data[0];

    mediump vec2 a_zoom = unpack_float(a_data[3]);
    mediump float a_minzoom = a_zoom[0];
    mediump float a_maxzoom = a_zoom[1];

    // In order to accommodate placing labels around corners in
    // symbol-placement: line, each glyph in a label could have multiple
    // "quad"s only one of which should be shown at a given zoom level.
    // The min/max zoom assigned to each quad is based on the font size at
    // the vector tile's zoom level, which might be different than at the
    // currently rendered zoom level if text-size is zoom-dependent.
    // Thus, we compensate for this difference by calculating an adjustment
    // based on the scale of rendered text size relative to layout text size.
    mediump float layoutSize;
    if (!u_is_size_zoom_constant && !u_is_size_feature_constant) {
        v_size = mix(a_size[0], a_size[1], u_size_t) / 10.0;
        layoutSize = a_size[2] / 10.0;
    } else if (u_is_size_zoom_constant && !u_is_size_feature_constant) {
        v_size = a_size[0] / 10.0;
        layoutSize = v_size;
    } else if (!u_is_size_zoom_constant && u_is_size_feature_constant) {
        v_size = u_size;
        layoutSize = u_layout_size;
    } else {
        v_size = u_size;
        layoutSize = u_size;
    }

    float fontScale = u_is_text ? v_size / 24.0 : v_size;

    mediump float zoomAdjust = log2(v_size / layoutSize);
    mediump float adjustedZoom = (u_zoom - zoomAdjust) * 10.0;
    // result: z = 0 if a_minzoom <= adjustedZoom < a_maxzoom, and 1 otherwise
    // Used below to move the vertex out of the clip space for when the current
    // zoom is out of the glyph's zoom range.
    mediump float z = 2.0 - step(a_minzoom, adjustedZoom) - (1.0 - step(a_maxzoom, adjustedZoom));

    highp float segment_angle = -a_projected_pos[2];
    highp float angle_sin = sin(segment_angle);
    highp float angle_cos = cos(segment_angle);
    mat2 rotation_matrix = mat2(angle_cos, -1.0 * angle_sin, angle_sin, angle_cos);

    gl_Position = u_matrix * vec4(a_projected_pos.xy + rotation_matrix * (a_offset / 64.0 * fontScale), 0.0, 1.0);
    v_gamma_scale = gl_Position.w;

    v_tex = a_tex / u_texsize;
    v_fade_tex = vec2(a_labelminzoom / 255.0, 0.0);
}
