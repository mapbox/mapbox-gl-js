const float PI = 3.141592653589793;

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
uniform bool u_is_size_zoom_constant;
uniform bool u_is_size_feature_constant;
uniform highp float u_size_t; // used to interpolate between zoom stops when size is a composite function
uniform highp float u_size; // used when size is both zoom and feature constant

#pragma mapbox: define highp vec4 fill_color
#pragma mapbox: define highp vec4 halo_color
#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp float halo_width
#pragma mapbox: define lowp float halo_blur

uniform mat4 u_matrix;
uniform mat4 u_label_plane_matrix;
uniform mat4 u_gl_coord_matrix;

uniform bool u_is_text;
uniform bool u_pitch_with_map;
uniform highp float u_pitch;
uniform bool u_rotate_symbol;
uniform highp float u_aspect_ratio;
uniform highp float u_camera_to_center_distance;
uniform highp float u_collision_y_stretch;

uniform vec2 u_texsize;

varying vec4 v_data0;
varying vec2 v_data1;

void main() {
    #pragma mapbox: initialize highp vec4 fill_color
    #pragma mapbox: initialize highp vec4 halo_color
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize lowp float halo_width
    #pragma mapbox: initialize lowp float halo_blur

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
    // If the label is pitched with the map, layout is done in pitched space,
    // which makes labels in the distance smaller relative to viewport space.
    // We counteract part of that effect by multiplying by the perspective ratio.
    // If the label isn't pitched with the map, we do layout in viewport space,
    // which makes labels in the distance larger relative to the features around
    // them. We counteract part of that effect by dividing by the perspective ratio.
    highp float distance_ratio = u_pitch_with_map ?
        camera_to_anchor_distance / u_camera_to_center_distance :
        u_camera_to_center_distance / camera_to_anchor_distance;
    highp float perspective_ratio = 0.5 + 0.5 * distance_ratio;

    size *= perspective_ratio;

    float fontScale = u_is_text ? size / 24.0 : size;

    highp float symbol_rotation = 0.0;
    if (u_rotate_symbol) {
        // Point labels with 'rotation-alignment: map' are horizontal with respect to tile units
        // To figure out that angle in projected space, we draw a short horizontal line in tile
        // space, project it, and measure its angle in projected space.
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
    float gamma_scale = gl_Position.w;

    vec2 tex = a_tex / u_texsize;
    // incidence_stretch is the ratio of how much y space a label takes up on a tile while drawn perpendicular to the viewport vs
    //  how much space it would take up if it were drawn flat on the tile
    // Using law of sines, camera_to_anchor/sin(ground_angle) = camera_to_center/sin(incidence_angle)
    // sin(incidence_angle) = 1/incidence_stretch
    // Incidence angle 90 -> head on, sin(incidence_angle) = 1, no incidence stretch
    // Incidence angle 1 -> very oblique, sin(incidence_angle) =~ 0, lots of incidence stretch
    // ground_angle = u_pitch + PI/2 -> sin(ground_angle) = cos(u_pitch)
    // This 2D calculation is only exactly correct when gl_Position.x is in the center of the viewport,
    //  but it's a close enough approximation for our purposes
    highp float incidence_stretch  = camera_to_anchor_distance / (u_camera_to_center_distance * cos(u_pitch));
    // incidence_stretch only applies to the y-axis, but without re-calculating the collision tile, we can't
    // adjust the size of only one axis. So, we do a crude approximation at placement time to get the aspect ratio
    // about right, and then do the rest of the adjustment here: there will be some extra padding on the x-axis,
    // but hopefully not too much.
    // Never make the adjustment less than 1.0: instead of allowing collisions on the x-axis, be conservative on
    // the y-axis.
    highp float collision_adjustment = max(1.0, incidence_stretch / u_collision_y_stretch);

    // Floor to 1/10th zoom to dodge precision issues that can cause partially hidden labels
    highp float collision_perspective_ratio = 1.0 + 0.5*((camera_to_anchor_distance / u_camera_to_center_distance) - 1.0);
    highp float perspective_zoom_adjust = floor(log2(collision_perspective_ratio * collision_adjustment) * 10.0);
    vec2 fade_tex = vec2((a_labelminzoom + perspective_zoom_adjust) / 255.0, 0.0);

    v_data0 = vec4(tex.x, tex.y, fade_tex.x, fade_tex.y);
    v_data1 = vec2(gamma_scale, size);
}
