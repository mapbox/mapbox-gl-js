// floor(127 / 2) == 63.0
// the maximum allowed miter limit is 2.0 at the moment. the extrude normal is
// stored in a byte (-128..127). we scale regular normals up to length 63, but
// there are also "special" normals that have a bigger length (of up to 126 in
// this case).
// #define scale 63.0
#define EXTRUDE_SCALE 0.015873016

attribute vec2 a_pos_normal;
attribute vec4 a_data;

#ifdef RENDER_LINE_GRADIENT
// Includes in order: a_uv_x, a_split_index, a_linesofar
// to reduce attribute count on older devices
attribute vec3 a_packed;
#else
attribute float a_linesofar;
#endif

uniform mat4 u_matrix;
uniform mediump float u_ratio;
uniform vec2 u_units_to_pixels;
uniform lowp float u_device_pixel_ratio;

varying vec2 v_normal;
varying vec2 v_width2;
varying float v_gamma_scale;

#ifdef RENDER_LINE_DASH
uniform vec2 u_texsize;
uniform mediump vec3 u_scale;
varying vec2 v_tex_a;
varying vec2 v_tex_b;
#endif

#ifdef RENDER_LINE_GRADIENT
uniform float u_image_height;
varying highp vec2 v_uv;
#endif

#pragma mapbox: define highp vec4 color
#pragma mapbox: define lowp float floorwidth
#pragma mapbox: define lowp vec4 dash_from
#pragma mapbox: define lowp vec4 dash_to
#pragma mapbox: define lowp float blur
#pragma mapbox: define lowp float opacity
#pragma mapbox: define mediump float gapwidth
#pragma mapbox: define lowp float offset
#pragma mapbox: define mediump float width

void main() {
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize lowp float floorwidth
    #pragma mapbox: initialize lowp vec4 dash_from
    #pragma mapbox: initialize lowp vec4 dash_to
    #pragma mapbox: initialize lowp float blur
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize mediump float gapwidth
    #pragma mapbox: initialize lowp float offset
    #pragma mapbox: initialize mediump float width

    // the distance over which the line edge fades out.
    // Retina devices need a smaller distance to avoid aliasing.
    float ANTIALIASING = 1.0 / u_device_pixel_ratio / 2.0;

    vec2 a_extrude = a_data.xy - 128.0;
    float a_direction = mod(a_data.z, 4.0) - 1.0;
    vec2 pos = floor(a_pos_normal * 0.5);

    // x is 1 if it's a round cap, 0 otherwise
    // y is 1 if the normal points up, and -1 if it points down
    // We store these in the least significant bit of a_pos_normal
    mediump vec2 normal = a_pos_normal - 2.0 * pos;
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
    mediump vec2 dist = outset * a_extrude * EXTRUDE_SCALE;

    // Calculate the offset when drawing a line that is to the side of the actual line.
    // We do this by creating a vector that points towards the extrude, but rotate
    // it when we're drawing round end points (a_direction = -1 or 1) since their
    // extrude vector points in another direction.
    mediump float u = 0.5 * a_direction;
    mediump float t = 1.0 - abs(u);
    mediump vec2 offset2 = offset * a_extrude * EXTRUDE_SCALE * normal.y * mat2(t, -u, u, t);

    vec4 projected_extrude = u_matrix * vec4(dist / u_ratio, 0.0, 0.0);
    gl_Position = u_matrix * vec4(pos + offset2 / u_ratio, 0.0, 1.0) + projected_extrude;

#ifndef RENDER_TO_TEXTURE
    // calculate how much the perspective view squishes or stretches the extrude
    float extrude_length_without_perspective = length(dist);
    float extrude_length_with_perspective = length(projected_extrude.xy / gl_Position.w * u_units_to_pixels);
    v_gamma_scale = extrude_length_without_perspective / extrude_length_with_perspective;
#else
    v_gamma_scale = 1.0;
#endif

#ifdef RENDER_LINE_GRADIENT
    float a_uv_x = a_packed[0];
    float a_split_index = a_packed[1];
    float a_linesofar = a_packed[2];
    highp float texel_height = 1.0 / u_image_height;
    highp float half_texel_height = 0.5 * texel_height;
    v_uv = vec2(a_uv_x, a_split_index * texel_height - half_texel_height);
#endif

#ifdef RENDER_LINE_DASH
    float tileZoomRatio = u_scale.x;
    float fromScale = u_scale.y;
    float toScale = u_scale.z;

    float scaleA = dash_from.z == 0.0 ? 0.0 : tileZoomRatio / (dash_from.z * fromScale);
    float scaleB = dash_to.z == 0.0 ? 0.0 : tileZoomRatio / (dash_to.z * toScale);
    float heightA = dash_from.y;
    float heightB = dash_to.y;

    v_tex_a = vec2(a_linesofar * scaleA / floorwidth, (-normal.y * heightA + dash_from.x + 0.5) / u_texsize.y);
    v_tex_b = vec2(a_linesofar * scaleB / floorwidth, (-normal.y * heightB + dash_to.x + 0.5) / u_texsize.y);
#endif

    v_width2 = vec2(outset, inset);

#ifdef FOG
    v_fog_pos = fog_position(pos);
#endif
}
