#include "_prelude_fog.vertex.glsl"
#include "_prelude_shadow.vertex.glsl"
#include "_prelude_terrain.vertex.glsl"

// floor(127 / 2) == 63.0
// the maximum allowed miter limit is 2.0 at the moment. the extrude normal is
// stored in a byte (-128..127). we scale regular normals up to length 63, but
// there are also "special" normals that have a bigger length (of up to 126 in
// this case).
// #define scale 63.0
#define scale 0.015873016

in vec2 a_pos_normal;
in vec4 a_data;
#if defined(ELEVATED) || defined(ELEVATED_ROADS)
in vec3 a_z_offset_width;
#endif
// Includes in order: a_uv_x, a_split_index, a_line_progress
// to reduce attribute count on older devices.
// Only line-trim-offset will requires a_packed info.
#ifdef RENDER_LINE_TRIM_OFFSET
in highp vec3 a_packed;
#endif
in highp float a_linesofar;

#ifdef LINE_JOIN_NONE
in highp vec3 a_pattern_data; // [position_in_segment & offset_sign, segment_length, linesofar_hi];
out vec2 v_pattern_data; // [position_in_segment, segment_length]
#endif

#ifdef INDICATOR_CUTOUT
out highp float v_z_offset;
#endif

uniform mat4 u_matrix;
uniform float u_tile_units_to_pixels;
uniform vec2 u_units_to_pixels;
uniform mat2 u_pixels_to_tile_units;
uniform float u_device_pixel_ratio;
uniform float u_width_scale;
uniform float u_floor_width_scale;

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
out vec2 v_width2;
out highp float v_linesofar;
out float v_gamma_scale;
out float v_width;
#ifdef RENDER_LINE_TRIM_OFFSET
out highp vec3 v_uv;
#endif
#ifdef ELEVATED_ROADS
out highp float v_road_z_offset;
#endif

#ifdef RENDER_SHADOWS
uniform mat4 u_light_matrix_0;
uniform mat4 u_light_matrix_1;

out highp vec4 v_pos_light_view_0;
out highp vec4 v_pos_light_view_1;
out highp float v_depth;
#endif

#pragma mapbox: define mediump float blur
#pragma mapbox: define mediump float opacity
#pragma mapbox: define mediump float offset
#pragma mapbox: define mediump float gapwidth
#pragma mapbox: define mediump float width
#pragma mapbox: define mediump float floorwidth
#pragma mapbox: define mediump vec4 pattern
#ifdef LINE_PATTERN_TRANSITION
#pragma mapbox: define mediump vec4 pattern_b
#endif
#pragma mapbox: define mediump float pixel_ratio

void main() {
    #pragma mapbox: initialize mediump float blur
    #pragma mapbox: initialize mediump float opacity
    #pragma mapbox: initialize mediump float offset
    #pragma mapbox: initialize mediump float gapwidth
    #pragma mapbox: initialize mediump float width
    #pragma mapbox: initialize mediump float floorwidth
    #pragma mapbox: initialize mediump vec4 pattern
    #ifdef LINE_PATTERN_TRANSITION
    #pragma mapbox: initialize mediump vec4 pattern_b
    #endif
    #pragma mapbox: initialize mediump float pixel_ratio

    float a_z_offset;
#if defined(ELEVATED) || defined(ELEVATED_ROADS)
    a_z_offset = a_z_offset_width.x;
#endif

    // the distance over which the line edge fades out.
    // Retina devices need a smaller distance to avoid aliasing.
    float ANTIALIASING = 1.0 / u_device_pixel_ratio / 2.0;

    vec2 a_extrude = a_data.xy - 128.0;
    float a_direction = mod(a_data.z, 4.0) - 1.0;

    vec2 pos = floor(a_pos_normal * 0.5);

    // x is 1 if it's a round cap, 0 otherwise
    // y is 1 if the normal points up, and -1 if it points down
    // We store these in the least significant bit of a_pos_normal
    vec2 normal = a_pos_normal - 2.0 * pos;
    normal.y = normal.y * 2.0 - 1.0;
    v_normal = normal;

    // these transformations used to be applied in the JS and native code bases.
    // moved them into the shader for clarity and simplicity.
    gapwidth = gapwidth / 2.0;
    float halfwidth = (u_width_scale * width) / 2.0;
    offset = -1.0 * offset * u_width_scale;

    float inset = gapwidth + (gapwidth > 0.0 ? ANTIALIASING : 0.0);
    float outset = gapwidth + halfwidth * (gapwidth > 0.0 ? 2.0 : 1.0) + (halfwidth == 0.0 ? 0.0 : ANTIALIASING);

    // Scale the extrusion vector down to a normal and then up by the line width
    // of this vertex.
    vec2 dist = outset * a_extrude * scale;

    // Calculate the offset when drawing a line that is to the side of the actual line.
    // We do this by creating a vector that points towards the extrude, but rotate
    // it when we're drawing round end points (a_direction = -1 or 1) since their
    // extrude vector points in another direction.
    float u = 0.5 * a_direction;
    float t = 1.0 - abs(u);
    vec2 offset2 = offset * a_extrude * scale * normal.y * mat2(t, -u, u, t);

    float hidden = float(opacity == 0.0);
    vec2 extrude = dist * u_pixels_to_tile_units;
    vec4 projected_extrude = u_matrix * vec4(extrude, 0.0, 0.0);
    vec2 projected_extrude_xy = projected_extrude.xy;
#ifdef ELEVATED_ROADS
    v_road_z_offset = a_z_offset;
    gl_Position = u_matrix * vec4(pos + offset2 * u_pixels_to_tile_units, a_z_offset, 1.0) + projected_extrude;
#else
#ifdef ELEVATED
    vec2 offsetTile = offset2 * u_pixels_to_tile_units;
    vec2 offset_pos = pos + offsetTile;
    float ele = 0.0;
#ifdef CROSS_SLOPE_VERTICAL
    // Vertical line
    // The least significant bit of a_pos_normal.y hold 1 if it's on top, 0 for bottom
    float top = a_pos_normal.y - 2.0 * floor(a_pos_normal.y * 0.5);
    float line_height = 2.0 * u_tile_to_meter * outset * top * u_pixels_to_tile_units[1][1] + a_z_offset;
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
    ele = ele_max + a_z_offset;
#else // CROSS_SLOPE_HORIZONTAL
    // Line follows terrain slope
    float ele0 = sample_elevation(offset_pos);
    float ele1 = max(sample_elevation(offset_pos + extrude), sample_elevation(offset_pos + extrude / 2.0));
    float ele2 = max(sample_elevation(offset_pos - extrude), sample_elevation(offset_pos - extrude / 2.0));
    float ele_max = max(ele0, 0.5 * (ele1 + ele2));
    ele = ele_max - ele0 + ele1 + a_z_offset;
#endif // CROSS_SLOPE_HORIZONTAL
#endif // CROSS_SLOPE_VERTICAL
    gl_Position = u_matrix * vec4(offset_pos, ele, 1.0) + projected_extrude;
    float z = clamp(gl_Position.z / gl_Position.w, 0.5, 1.0);
    float zbias = max(0.00005, (pow(z, 0.8) - z) * u_zbias_factor * u_exaggeration);
    gl_Position.z -= (gl_Position.w * zbias);
    gl_Position = mix(gl_Position, AWAY, hidden);
#else // ELEVATED
    gl_Position = mix(u_matrix * vec4(pos + offset2 * u_pixels_to_tile_units, 0.0, 1.0) + projected_extrude, AWAY, hidden);
#endif // ELEVATED
#endif // ELEVATED_ROADS

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
    // calculate how much the perspective view squishes or stretches the extrude
    float extrude_length_without_perspective = length(dist);
    float extrude_length_with_perspective = length(projected_extrude_xy / gl_Position.w * u_units_to_pixels);
    v_gamma_scale = mix(extrude_length_without_perspective / extrude_length_with_perspective, 1.0, step(0.01, blur));
#else
    v_gamma_scale = 1.0;
#endif

#ifdef RENDER_LINE_TRIM_OFFSET
    highp float a_uv_x = a_packed[0];
    highp float line_progress = a_packed[2];
    v_uv = vec3(a_uv_x, 0.0, line_progress);
#endif

    v_linesofar = a_linesofar;
    v_width2 = vec2(outset, inset);
    v_width = (floorwidth * u_floor_width_scale);

#ifdef LINE_JOIN_NONE
    // Needs to consider antialiasing width extension to get accurate pattern aspect ratio
    v_width = (floorwidth * u_floor_width_scale) + ANTIALIASING;

    mediump float pixels_to_tile_units = 1.0 / u_tile_units_to_pixels;
    mediump float pixel_ratio_inverse = 1.0 / pixel_ratio;
    mediump float aspect = v_width / ((pattern.w - pattern.y) * pixel_ratio_inverse);
    // Pattern length * 32 is chosen experimentally, seems to provide good quality
    highp float subt_multiple = (pattern.z - pattern.x) * pixel_ratio_inverse * pixels_to_tile_units * aspect * 32.0;
    highp float subt = floor(a_pattern_data.z / subt_multiple) * subt_multiple;

    // Offset caused by vertices extended forward or backward from line point
    float offset_sign = (fract(a_pattern_data.x) - 0.5) * 4.0;
    float line_progress_offset = offset_sign * v_width * 0.5 * pixels_to_tile_units;
    v_linesofar = (a_pattern_data.z - subt) + a_linesofar + line_progress_offset;
    v_pattern_data = vec2(a_pattern_data.x + line_progress_offset, a_pattern_data.y);
#endif

#ifdef FOG
    v_fog_pos = fog_position(pos);
#endif

#ifdef INDICATOR_CUTOUT
    v_z_offset = a_z_offset;
#endif
}
