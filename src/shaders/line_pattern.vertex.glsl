#include "_prelude_fog.vertex.glsl"
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
#if defined(ELEVATED)
in float a_z_offset;
#endif
// Includes in order: a_uv_x, a_split_index, a_clip_start, a_clip_end
// to reduce attribute count on older devices.
// Only line-trim-offset will requires a_packed info.
#ifdef RENDER_LINE_TRIM_OFFSET
in highp vec4 a_packed;
#endif
in highp float a_linesofar;

#ifdef LINE_JOIN_NONE
in highp vec3 a_pattern_data; // [position_in_segment & offset_sign, segment_length, linesofar_hi];
out vec2 v_pattern_data; // [position_in_segment, segment_length]
#endif

uniform mat4 u_matrix;
uniform float u_tile_units_to_pixels;
uniform vec2 u_units_to_pixels;
uniform mat2 u_pixels_to_tile_units;
uniform float u_device_pixel_ratio;

out vec2 v_normal;
out vec2 v_width2;
out highp float v_linesofar;
out float v_gamma_scale;
out float v_width;
#ifdef RENDER_LINE_TRIM_OFFSET
out highp vec4 v_uv;
#endif

#pragma mapbox: define mediump float blur
#pragma mapbox: define mediump float opacity
#pragma mapbox: define mediump float offset
#pragma mapbox: define mediump float gapwidth
#pragma mapbox: define mediump float width
#pragma mapbox: define mediump float floorwidth
#pragma mapbox: define mediump vec4 pattern
#pragma mapbox: define mediump float pixel_ratio

void main() {
    #pragma mapbox: initialize mediump float blur
    #pragma mapbox: initialize mediump float opacity
    #pragma mapbox: initialize mediump float offset
    #pragma mapbox: initialize mediump float gapwidth
    #pragma mapbox: initialize mediump float width
    #pragma mapbox: initialize mediump float floorwidth
    #pragma mapbox: initialize mediump vec4 pattern
    #pragma mapbox: initialize mediump float pixel_ratio

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
    float halfwidth = width / 2.0;
    offset = -1.0 * offset;

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

    vec4 projected_extrude = u_matrix * vec4(dist * u_pixels_to_tile_units, 0.0, 0.0);
#if defined(ELEVATED)
    vec2 offsetTile = offset2 * u_pixels_to_tile_units;
    // forward or backward along the line, perpendicular to offset
    vec2 halfCellProgress = normal.yx * 32.0;
    float ele0 = elevation(pos);
    float ele_line = max(ele0, max(elevation(pos + halfCellProgress), elevation(pos - halfCellProgress)));
    float ele1 = elevation(pos + offsetTile);
    float ele2 = elevation(pos - offsetTile);
    float ele_max = max(ele_line, 0.5 * (ele1 + ele2));
    // keep cross slope by default
    float ele = ele_max - ele0 + ele1 + a_z_offset ;
    gl_Position = u_matrix * vec4(pos + offsetTile, ele, 1.0) + projected_extrude;
    float z = clamp(gl_Position.z / gl_Position.w, 0.5, 1.0);
    float zbias = max(0.00005, (pow(z, 0.8) - z) * 0.1 * u_exaggeration);
    gl_Position.z -= (gl_Position.w * zbias);
#else
    gl_Position = u_matrix * vec4(pos + offset2 * u_pixels_to_tile_units, 0.0, 1.0) + projected_extrude;
#endif


#ifndef RENDER_TO_TEXTURE
    // calculate how much the perspective view squishes or stretches the extrude
    float extrude_length_without_perspective = length(dist);
    float extrude_length_with_perspective = length(projected_extrude.xy / gl_Position.w * u_units_to_pixels);
    v_gamma_scale = extrude_length_without_perspective / extrude_length_with_perspective;
#else
    v_gamma_scale = 1.0;
#endif

#ifdef RENDER_LINE_TRIM_OFFSET
    float a_uv_x = a_packed[0];
    highp float a_clip_start = a_packed[2];
    highp float a_clip_end = a_packed[3];
    v_uv = vec4(a_uv_x, 0.0, a_clip_start, a_clip_end);
#endif

    v_linesofar = a_linesofar;
    v_width2 = vec2(outset, inset);
    v_width = floorwidth;

#ifdef LINE_JOIN_NONE
    // Needs to consider antialiasing width extension to get accurate pattern aspect ratio
    v_width = floorwidth + ANTIALIASING;

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
}
