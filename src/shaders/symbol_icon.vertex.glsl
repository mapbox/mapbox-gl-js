const float PI = 3.141592653589793;

attribute vec4 a_pos_offset;
attribute vec4 a_data;
attribute vec3 a_projected_pos;

uniform bool u_is_size_zoom_constant;
uniform bool u_is_size_feature_constant;
uniform highp float u_size_t; // used to interpolate between zoom stops when size is a composite function
uniform highp float u_size; // used when size is both zoom and feature constant
uniform highp float u_camera_to_center_distance;
uniform highp float u_pitch;
uniform bool u_rotate_symbol;
uniform highp float u_aspect_ratio;
uniform highp float u_collision_y_stretch;

#pragma mapbox: define lowp float opacity

uniform mat4 u_matrix;
uniform mat4 u_label_plane_matrix;
uniform mat4 u_gl_coord_matrix;

uniform bool u_is_text;
uniform bool u_pitch_with_map;

uniform vec2 u_texsize;

varying vec2 v_tex;
varying vec2 v_fade_tex;

void main() {
    #pragma mapbox: initialize lowp float opacity

    vec2 a_pos = a_pos_offset.xy;
    vec2 a_offset = a_pos_offset.zw;

    vec2 a_tex = a_data.xy;
    vec2 a_size = a_data.zw;

    highp vec2 angle_labelminzoom = unpack_float(a_projected_pos[2]);
    highp float segment_angle = -angle_labelminzoom[0] / 255.0 * 2.0 * PI;
    mediump float a_labelminzoom = angle_labelminzoom[1];

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

    vec4 projectedPoint = u_matrix * vec4(a_pos, 0, 1);
    highp float camera_to_anchor_distance = projectedPoint.w;
    // See comments in symbol_sdf.vertex
    highp float distance_ratio = u_pitch_with_map ?
        camera_to_anchor_distance / u_camera_to_center_distance :
        u_camera_to_center_distance / camera_to_anchor_distance;
    highp float perspective_ratio = 0.5 + 0.5 * distance_ratio;

    size *= perspective_ratio;

    float fontScale = u_is_text ? size / 24.0 : size;

    highp float symbol_rotation = 0.0;
    if (u_rotate_symbol) {
        // See comments in symbol_sdf.vertex
        vec4 offsetProjectedPoint = u_matrix * vec4(a_pos + vec2(1, 0), 0, 1);

        vec2 a = projectedPoint.xy / projectedPoint.w;
        vec2 b = offsetProjectedPoint.xy / offsetProjectedPoint.w;

        symbol_rotation = atan((b.y - a.y) / u_aspect_ratio, b.x - a.x);
    }

    highp float angle_sin = sin(segment_angle + symbol_rotation);
    highp float angle_cos = cos(segment_angle + symbol_rotation);
    mat2 rotation_matrix = mat2(angle_cos, -1.0 * angle_sin, angle_sin, angle_cos);

    vec4 projected_pos = u_label_plane_matrix * vec4(a_projected_pos.xy, 0.0, 1.0);
    gl_Position = u_gl_coord_matrix * vec4(projected_pos.xy / projected_pos.w + rotation_matrix * (a_offset / 64.0 * fontScale), 0.0, 1.0);

    v_tex = a_tex / u_texsize;
    // See comments in symbol_sdf.vertex
    highp float incidence_stretch  = camera_to_anchor_distance / (u_camera_to_center_distance * cos(u_pitch));
    highp float collision_adjustment = max(1.0, incidence_stretch / u_collision_y_stretch);

    highp float collision_perspective_ratio = 1.0 + 0.5*((camera_to_anchor_distance / u_camera_to_center_distance) - 1.0);
    highp float perspective_zoom_adjust = floor(log2(collision_perspective_ratio * collision_adjustment) * 10.0);
    v_fade_tex = vec2((a_labelminzoom + perspective_zoom_adjust) / 255.0, 0.0);
}
