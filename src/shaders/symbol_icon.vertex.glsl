attribute vec4 a_pos_offset;
attribute vec4 a_data;
attribute vec3 a_projected_pos;

// icon-size data (see symbol_sdf.vertex.glsl for more)
attribute vec2 a_size;
uniform bool u_is_size_zoom_constant;
uniform bool u_is_size_feature_constant;
uniform mediump float u_size_t; // used to interpolate between zoom stops when size is a composite function
uniform mediump float u_size; // used when size is both zoom and feature constant

#pragma mapbox: define lowp float opacity

// matrix is for the vertex position.
uniform mat4 u_matrix;

uniform bool u_is_text;

uniform vec2 u_texsize;

varying vec2 v_tex;
varying vec2 v_fade_tex;

void main() {
    #pragma mapbox: initialize lowp float opacity

    vec2 a_pos = a_pos_offset.xy;
    vec2 a_offset = a_pos_offset.zw;

    vec2 a_tex = a_data.xy;
    mediump vec2 label_data = unpack_float(a_data[2]);
    mediump float a_labelminzoom = label_data[0];

    float size;
    if (!u_is_size_zoom_constant && !u_is_size_feature_constant) {
        size = mix(a_size[0], a_size[1], u_size_t) / 10.0;
    } else if (u_is_size_zoom_constant && !u_is_size_feature_constant) {
        size = a_size[0] / 10.0;
    } else if (!u_is_size_zoom_constant && u_is_size_feature_constant) {
        size = u_size;
    } else {
        size = u_size;
    }

    float fontScale = u_is_text ? size / 24.0 : size;

    highp float segment_angle = -a_projected_pos[2];
    highp float angle_sin = sin(segment_angle);
    highp float angle_cos = cos(segment_angle);
    mat2 rotation_matrix = mat2(angle_cos, -1.0 * angle_sin, angle_sin, angle_cos);

    gl_Position = u_matrix * vec4(a_projected_pos.xy + rotation_matrix * (a_offset / 64.0 * fontScale), 0.0, 1.0);

    v_tex = a_tex / u_texsize;
    v_fade_tex = vec2(a_labelminzoom / 255.0, 0.0);
}
