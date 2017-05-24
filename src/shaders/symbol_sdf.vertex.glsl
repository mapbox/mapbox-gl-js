const float PI = 3.141592653589793;

// NOTE: the a_data attribute in this shader is manually bound (see https://github.com/mapbox/mapbox-gl-js/issues/4607).
// If removing or renaming a_data, revisit the manual binding in painter.js accordingly.
attribute vec4 a_pos_offset;
attribute vec2 a_label_pos;
attribute vec4 a_data;

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
uniform highp float u_size_t; // used to interpolate between zoom stops when size is a composite function
uniform highp float u_size; // used when size is both zoom and feature constant
uniform highp float u_layout_size; // used when size is feature constant

#pragma mapbox: define highp vec4 fill_color
#pragma mapbox: define highp vec4 halo_color
#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp float halo_width
#pragma mapbox: define lowp float halo_blur

// matrix is for the vertex position.
uniform mat4 u_matrix;

uniform bool u_is_text;
uniform highp float u_zoom;
uniform bool u_rotate_with_map;
uniform bool u_pitch_with_map;
uniform highp float u_pitch;
uniform highp float u_bearing;
uniform highp float u_aspect_ratio;
uniform highp float u_camera_to_center_distance;
uniform highp float u_max_camera_distance;
uniform highp float u_collision_y_stretch;
uniform vec2 u_extrude_scale;

uniform vec2 u_texsize;

varying vec2 v_tex;
varying vec2 v_fade_tex;
varying float v_gamma_scale;
varying float v_size;

// Used below to move the vertex out of the clip space for when the current
// zoom is out of the glyph's zoom range.
highp float clipUnusedGlyphAngles(const highp float render_size,
                                  const highp float layout_size,
                                  const highp float min_zoom,
                                  const highp float max_zoom) {
    highp float zoom_adjust = log2(render_size / layout_size);
    highp float adjusted_zoom = (u_zoom - zoom_adjust) * 10.0;
    // result: 0 if min_zoom <= adjusted_zoom < max_zoom, and 1 otherwise
    return 2.0 - step(min_zoom, adjusted_zoom) - (1.0 - step(max_zoom, adjusted_zoom));
}

void main() {
    #pragma mapbox: initialize highp vec4 fill_color
    #pragma mapbox: initialize highp vec4 halo_color
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize lowp float halo_width
    #pragma mapbox: initialize lowp float halo_blur

    vec2 a_pos = a_pos_offset.xy;
    vec2 a_offset = a_pos_offset.zw;

    vec2 a_tex = a_data.xy;

    highp vec2 label_data = unpack_float(a_data[2]);
    highp float a_labelminzoom = label_data[0];
    highp float a_lineangle = (label_data[1] / 256.0 * 2.0 * PI);
    highp vec2 a_zoom = unpack_float(a_data[3]);
    highp float a_minzoom = a_zoom[0];
    highp float a_maxzoom = a_zoom[1];

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

    vec4 projectedPoint = u_matrix * vec4(a_label_pos, 0, 1);
    highp float camera_to_anchor_distance = projectedPoint.w;
    highp float perspective_ratio = 1.0 + 0.5*((camera_to_anchor_distance / u_camera_to_center_distance) - 1.0);

    // pitch-alignment: map
    // rotation-alignment: map | viewport
    if (u_pitch_with_map) {
        highp float angle = u_rotate_with_map ? a_lineangle : u_bearing;
        highp float asin = sin(angle);
        highp float acos = cos(angle);
        mat2 RotationMatrix = mat2(acos, asin, -1.0 * asin, acos);
        vec2 offset = RotationMatrix * a_offset;
        vec2 extrude = fontScale * u_extrude_scale * perspective_ratio * (offset / 64.0);

        gl_Position = u_matrix * vec4(a_pos + extrude, 0, 1);
        gl_Position.z += clipUnusedGlyphAngles(v_size*perspective_ratio, layoutSize, a_minzoom, a_maxzoom) * gl_Position.w;
    // pitch-alignment: viewport
    // rotation-alignment: map
    } else if (u_rotate_with_map) {
        // foreshortening factor to apply on pitched maps
        // as a label goes from horizontal <=> vertical in angle
        // it goes from 0% foreshortening to up to around 70% foreshortening
        highp float pitchfactor = 1.0 - cos(u_pitch * sin(u_pitch * 0.75));

        // use the lineangle to position points a,b along the line
        // project the points and calculate the label angle in projected space
        // this calculation allows labels to be rendered unskewed on pitched maps
        vec4 a = u_matrix * vec4(a_pos, 0, 1);
        vec4 b = u_matrix * vec4(a_pos + vec2(cos(a_lineangle), sin(a_lineangle)), 0, 1);
        highp float angle = atan((b[1] / b[3] - a[1] / a[3]) / u_aspect_ratio, b[0] / b[3] - a[0] / a[3]);
        highp float asin = sin(angle);
        highp float acos = cos(angle);
        mat2 RotationMatrix = mat2(acos, -1.0 * asin, asin, acos);
        highp float foreshortening = (1.0 - pitchfactor) + (pitchfactor * cos(angle * 2.0));

        vec2 offset = RotationMatrix * (vec2(foreshortening, 1.0) * a_offset);
        vec2 extrude = fontScale * u_extrude_scale * perspective_ratio * (offset / 64.0);

        gl_Position = u_matrix * vec4(a_pos, 0, 1) + vec4(extrude, 0, 0);
        gl_Position.z += clipUnusedGlyphAngles(v_size * perspective_ratio, layoutSize, a_minzoom, a_maxzoom) * gl_Position.w;
    // pitch-alignment: viewport
    // rotation-alignment: viewport
    } else {
        vec2 extrude = fontScale * u_extrude_scale * perspective_ratio * (a_offset / 64.0);
        gl_Position = u_matrix * vec4(a_pos, 0, 1) + vec4(extrude, 0, 0);
    }

    gl_Position.z +=
        step(u_max_camera_distance * u_camera_to_center_distance, camera_to_anchor_distance) * gl_Position.w;

    v_gamma_scale = gl_Position.w / perspective_ratio;

    v_tex = a_tex / u_texsize;
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

    highp float perspective_zoom_adjust = log2(perspective_ratio * collision_adjustment) * 10.0;
    v_fade_tex = vec2((a_labelminzoom + perspective_zoom_adjust) / 255.0, 0.0);
}
