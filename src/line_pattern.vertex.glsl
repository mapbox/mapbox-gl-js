#ifdef GL_ES
precision highp float;
#else
#define lowp
#define mediump
#define highp
#endif

// floor(127 / 2) == 63.0
// the maximum allowed miter limit is 2.0 at the moment. the extrude normal is
// stored in a byte (-128..127). we scale regular normals up to length 63, but
// there are also "special" normals that have a bigger length (of up to 126 in
// this case).
// #define scale 63.0
#define scale 0.015873016

// We scale the distance before adding it to the buffers so that we can store
// long distances for long segments. Use this value to unscale the distance.
#define LINE_DISTANCE_SCALE 2.0

attribute vec2 a_pos;
attribute vec4 a_data;

uniform mat4 u_matrix;
uniform mediump float u_ratio;
uniform mediump float u_linewidth;
uniform mediump float u_gapwidth;
uniform mediump float u_antialiasing;
uniform mediump float u_extra;
uniform mat2 u_antialiasingmatrix;
uniform mediump float u_offset;

varying vec2 v_normal;
varying vec2 v_linewidth;
varying float v_linesofar;
varying float v_gamma_scale;

void main() {
    vec2 a_extrude = a_data.xy - 128.0;
    float a_direction = mod(a_data.z, 4.0) - 1.0;
    float a_linesofar = (floor(a_data.z / 4.0) + a_data.w * 64.0) * LINE_DISTANCE_SCALE;

    // We store the texture normals in the most insignificant bit
    // transform y so that 0 => -1 and 1 => 1
    // In the texture normal, x is 0 if the normal points straight up/down and 1 if it's a round cap
    // y is 1 if the normal points up, and -1 if it points down
    mediump vec2 normal = mod(a_pos, 2.0);
    normal.y = sign(normal.y - 0.5);
    v_normal = normal;

    float inset = u_gapwidth + (u_gapwidth > 0.0 ? u_antialiasing : 0.0);
    float outset = u_gapwidth + u_linewidth * (u_gapwidth > 0.0 ? 2.0 : 1.0) + u_antialiasing;

    // Scale the extrusion vector down to a normal and then up by the line width
    // of this vertex.
    mediump vec2 dist = outset * a_extrude * scale;

    // Calculate the offset when drawing a line that is to the side of the actual line.
    // We do this by creating a vector that points towards the extrude, but rotate
    // it when we're drawing round end points (a_direction = -1 or 1) since their
    // extrude vector points in another direction.
    mediump float u = 0.5 * a_direction;
    mediump float t = 1.0 - abs(u);
    mediump vec2 offset = u_offset * a_extrude * scale * normal.y * mat2(t, -u, u, t);

    // Remove the texture normal bit of the position before scaling it with the
    // model/view matrix.
    gl_Position = u_matrix * vec4(floor(a_pos * 0.5) + (offset + dist) / u_ratio, 0.0, 1.0);
    v_linesofar = a_linesofar;

    // position of y on the screen
    float y = gl_Position.y / gl_Position.w;

    // how much features are squished in the y direction by the tilt
    float squish_scale = length(a_extrude) / length(u_antialiasingmatrix * a_extrude);

    // how much features are squished in all directions by the perspectiveness
    float perspective_scale = 1.0 / (1.0 - min(y * u_extra, 0.9));

    v_linewidth = vec2(outset, inset);
    v_gamma_scale = perspective_scale * squish_scale;
}
