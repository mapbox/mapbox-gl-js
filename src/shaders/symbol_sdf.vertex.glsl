attribute vec4 a_pos_offset;
attribute vec4 a_data;
attribute vec3 a_projected_pos;

// contents of a_size vary based on the type of property value
// used for {text,icon}-size.
// For constants, a_size is disabled.
// For source functions, we bind only one value per vertex: the value of {text,icon}-size evaluated for the current feature.
// For composite functions:
// [ text-size(lowerZoomStop, feature),
//   text-size(upperZoomStop, feature) ]
attribute vec2 a_size;
uniform bool u_is_size_zoom_constant;
uniform bool u_is_size_feature_constant;
uniform mediump float u_size_t; // used to interpolate between zoom stops when size is a composite function
uniform mediump float u_size; // used when size is both zoom and feature constant

#pragma mapbox: define highp vec4 fill_color
#pragma mapbox: define highp vec4 halo_color
#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp float halo_width
#pragma mapbox: define lowp float halo_blur

uniform mat4 u_label_plane_matrix;
uniform mat4 u_matrix;

uniform bool u_is_text;

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

    if (!u_is_size_zoom_constant && !u_is_size_feature_constant) {
        v_size = mix(a_size[0], a_size[1], u_size_t) / 10.0;
    } else if (u_is_size_zoom_constant && !u_is_size_feature_constant) {
        v_size = a_size[0] / 10.0;
    } else if (!u_is_size_zoom_constant && u_is_size_feature_constant) {
        v_size = u_size;
    } else {
        v_size = u_size;
    }

    float fontScale = u_is_text ? v_size / 24.0 : v_size;

    highp float segment_angle = -a_projected_pos[2];
    highp float angle_sin = sin(segment_angle);
    highp float angle_cos = cos(segment_angle);
    mat2 rotation_matrix = mat2(angle_cos, -1.0 * angle_sin, angle_sin, angle_cos);

    vec4 projected_pos = u_label_plane_matrix * vec4(a_projected_pos.xy, 0.0, 1.0);
    gl_Position = u_matrix * vec4(projected_pos.xy / projected_pos.w + rotation_matrix * (a_offset / 64.0 * fontScale), 0.0, 1.0);
    v_gamma_scale = gl_Position.w;

    v_tex = a_tex / u_texsize;
    v_fade_tex = vec2(a_labelminzoom / 255.0, 0.0);
}
